// ###################################################################################
// #                                                                                 #
// #    !!!   DANGER : CONFIGURATION MAINNET AVEC CLÉS INTÉGRÉES   !!!               #
// #                                                                                 #
// #    ATTENTION : Ce fichier contient des clés secrètes (API, Clé Privée, RPCs)    #
// #    directement dans le code. C'est une pratique de sécurité EXTRÊMEMENT         #
// #    DANGEREUSE.                                                                  #
// #                                                                                 #
// #    NE PARTAGEZ JAMAIS CE FICHIER. NE LE METTEZ JAMAIS SUR UN DÉPÔT GIT PUBLIC.   #
// #                                                                                 #
// #    Toute personne ayant accès à ce fichier peut voler tous les fonds de votre   #
// #    portefeuille.                                                                #
// #                                                                                 #
// #    Pour une utilisation réelle, utilisez TOUJOURS un fichier `.env` ou un      #
// #    gestionnaire de secrets (comme AWS KMS, Azure Key Vault).                    #
// #                                                                                 #
// ###################################################################################

// --- Clés RPC ---
const infuraKey = "6f76f3970b6d4ea08d24d825e3c7f86b";
const alchemyKey = "0QT7wJ8mXN6ImihIV7O20";
const quickNodeKey = "QN_c3adb60721754445bfaa103c8aea986f";

module.exports = {
    // --- Clés Secrètes ---
    // REMPLACEZ PAR VOTRE VÉRITABLE CLÉ API GEMINI
    geminiApiKey: "VOTRE_CLE_API_GEMINI_ICI",

    // Clé privée de portefeuille. PRUDENCE EXTRÊME.
    privateKey: "0x54923eccb60f4baa86a6e004a280b14b3b1de39b3ca18538f85d8f90c78b52c7",

    // --- Configuration RPC pour Polygon MAINNET (FONDS RÉELS) ---
    // Le bot utilisera ces URLs pour la redondance et la performance.
    rpcUrls: [
        `https://polygon-mainnet.infura.io/v3/${infuraKey}`,
        `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
        // ACTION REQUISE : Remplacez "VOTRE_ENDPOINT_QUICKNODE" par le nom de votre endpoint QuickNode.
        // Votre clé API a été ajoutée.
        `https://VOTRE_ENDPOINT_QUICKNODE.polygon-mainnet.discover.quiknode.pro/${quickNodeKey}/`
    ]
};
