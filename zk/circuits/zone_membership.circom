pragma circom 2.0.0;

include "../circomlib/circuits/comparators.circom";

/**
 * ZoneMembership: prueba que (lat, lng) cae dentro de un rectangulo
 * definido por [minLat, maxLat] x [minLng, maxLng].
 *
 * Inputs privados:
 *   - lat: latitud offseteada (lat_real + 90) * 10^6
 *   - lng: longitud offseteada (lng_real + 180) * 10^6
 *
 * Inputs publicos:
 *   - minLat, maxLat, minLng, maxLng: limites de la zona
 *   - zoneHash: identificador publico de la zona
 *
 * Output:
 *   - zoneHash (para ligar el proof a la zona)
 */
template ZoneMembership(nBits) {
    signal input lat;
    signal input lng;
    signal input minLat;
    signal input maxLat;
    signal input minLng;
    signal input maxLng;
    signal input zoneHash;

    signal output out;

    // minLat <= lat <= maxLat
    component geMinLat = GreaterEqThan(nBits);
    geMinLat.in[0] <== lat;
    geMinLat.in[1] <== minLat;
    geMinLat.out === 1;

    component leMaxLat = LessEqThan(nBits);
    leMaxLat.in[0] <== lat;
    leMaxLat.in[1] <== maxLat;
    leMaxLat.out === 1;

    // minLng <= lng <= maxLng
    component geMinLng = GreaterEqThan(nBits);
    geMinLng.in[0] <== lng;
    geMinLng.in[1] <== minLng;
    geMinLng.out === 1;

    component leMaxLng = LessEqThan(nBits);
    leMaxLng.in[0] <== lng;
    leMaxLng.in[1] <== maxLng;
    leMaxLng.out === 1;

    out <== zoneHash;
}

component main {public [minLat, maxLat, minLng, maxLng, zoneHash]} = ZoneMembership(32);
