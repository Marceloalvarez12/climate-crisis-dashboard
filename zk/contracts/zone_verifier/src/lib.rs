#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    crypto::bn254::{
        Bn254Fr, Bn254G1Affine, Bn254G2Affine, BN254_G1_SERIALIZED_SIZE, BN254_G2_SERIALIZED_SIZE,
    },
    Address, Bytes, Env, String, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Groth16Error {
    MalformedVerifyingKey = 0,
    InvalidProof = 1,
}

#[derive(Clone)]
#[contracttype]
pub struct VerificationKey {
    pub alpha: Bn254G1Affine,
    pub beta: Bn254G2Affine,
    pub gamma: Bn254G2Affine,
    pub delta: Bn254G2Affine,
    pub ic: Vec<Bn254G1Affine>,
}

#[derive(Clone)]
#[contracttype]
pub struct Proof {
    pub a: Bn254G1Affine,
    pub b: Bn254G2Affine,
    pub c: Bn254G1Affine,
}

#[derive(Clone)]
#[contracttype]
pub struct AuditRecord {
    pub operator: Address,
    pub incident_id: String,
    pub valid: bool,
    pub journal_digest_lo: u64,
    pub journal_digest_hi: u64,
    pub stored_at: u64,
}

include!("verification_key.rs");

fn vk(env: &Env) -> VerificationKey {
    let alpha = Bn254G1Affine::from_array(env, &VK_ALPHA);
    let beta = Bn254G2Affine::from_array(env, &VK_BETA);
    let gamma = Bn254G2Affine::from_array(env, &VK_GAMMA);
    let delta = Bn254G2Affine::from_array(env, &VK_DELTA);

    let mut ic = Vec::new(env);
    for p in VK_IC.iter() {
        ic.push_back(Bn254G1Affine::from_array(env, p));
    }

    VerificationKey {
        alpha,
        beta,
        gamma,
        delta,
        ic,
    }
}

fn verify_inner(env: &Env, proof: &Proof, pub_signals: &Vec<Bn254Fr>) -> bool {
    let bn = env.crypto().bn254();
    let vk = vk(env);

    if pub_signals.len() + 1 != vk.ic.len() {
        return false;
    }

    let mut vk_x = vk.ic.get(0).unwrap();
    for (s, v) in pub_signals.iter().zip(vk.ic.iter().skip(1)) {
        let prod = bn.g1_mul(&v, &s);
        vk_x = bn.g1_add(&vk_x, &prod);
    }

    let neg_a = -proof.a.clone();
    let vp1 = soroban_sdk::vec![env, neg_a, vk.alpha.clone(), vk_x, proof.c.clone()];
    let vp2 = soroban_sdk::vec![env, proof.b.clone(), vk.beta.clone(), vk.gamma.clone(), vk.delta.clone()];

    bn.pairing_check(vp1, vp2)
}

#[contract]
pub struct ZoneVerifier;

#[contractimpl]
impl ZoneVerifier {
    /// Read-only verification (no state change).
    pub fn verify_proof(
        env: Env,
        proof: Proof,
        pub_signals: Vec<Bn254Fr>,
    ) -> Result<bool, Groth16Error> {
        let vk = vk(&env);
        if pub_signals.len() + 1 != vk.ic.len() {
            return Err(Groth16Error::MalformedVerifyingKey);
        }
        Ok(verify_inner(&env, &proof, &pub_signals))
    }

    /// Verification that persists an audit record on-chain.
    /// Returns the stored AuditRecord.
    pub fn verify_and_store(
        env: Env,
        operator: Address,
        incident_id: String,
        proof: Proof,
        pub_signals: Vec<Bn254Fr>,
    ) -> Result<AuditRecord, Groth16Error> {
        operator.require_auth();

        let valid = verify_inner(&env, &proof, &pub_signals);
        if !valid {
            return Err(Groth16Error::InvalidProof);
        }

        // Build journal_digest = sha256(incident_id) split as two u64s (lo, hi).
        let incident_bytes = incident_id.clone().to_bytes();
        let mut concat: Bytes = Bytes::new(&env);
        concat.append(&incident_bytes);
        let digest = env.crypto().sha256(&concat);
        let raw: [u8; 32] = digest.to_array();

        let mut lo: u64 = 0;
        for i in 0..8 {
            lo = (lo << 8) | (raw[i] as u64);
        }
        let mut hi: u64 = 0;
        for i in 8..16 {
            hi = (hi << 8) | (raw[i] as u64);
        }

        let stored_at = env.ledger().timestamp();
        let record = AuditRecord {
            operator: operator.clone(),
            incident_id: incident_id.clone(),
            valid,
            journal_digest_lo: lo,
            journal_digest_hi: hi,
            stored_at,
        };

        env.storage().instance().set(&incident_id, &record);

        Ok(record)
    }

    /// Read a previously stored audit record.
    pub fn get_audit(env: Env, incident_id: String) -> Option<AuditRecord> {
        env.storage().instance().get(&incident_id)
    }
}
