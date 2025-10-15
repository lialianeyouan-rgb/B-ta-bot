// ###################################################################################
// #                                                                                 #
// #    !!!   DANGER : CONFIGURATION MAINNET   !!!                                   #
// #                                                                                 #
// #    Ce bot est maintenant configuré pour opérer sur le réseau principal         #
// #    (MAINNET) de Polygon. Toutes les transactions utiliseront des                #
// #    FONDS RÉELS. Une erreur peut entraîner une perte IRRÉVERSIBLE de capital.    #
// #                                                                                 #
// #    VÉRIFIEZ TOUT DEUX FOIS.                                                     #
// #                                                                                 #
// ###################################################################################

module.exports = {
    // Clé API pour l'API Gemini de Google
    geminiApiKey: "AIzaSyB_9tOr19WcNySmJPUO5YGeFiJfcDFjQiA",

    // Clé privée de votre portefeuille. Préfixée par '0x'. Ne la partagez JAMAIS.
    privateKey: "0x54923eccb60f4baa86a6e004a280b14b3b1de39b3ca18538f85d8f90c78b52c7",

    // URL des nœuds RPC pour se connecter à la blockchain Polygon MAINNET.
    // Le bot sélectionnera automatiquement le plus rapide et basculera en cas de panne.
    // Pour un avantage compétitif, remplacez ces points de terminaison publics par des
    // points de terminaison privés/payants de fournisseurs comme Alchemy, QuickNode, ou Infura Pro.
    rpcUrls: [
        "https://polygon-mainnet.infura.io/v3/5b3855db1fd24f84991ce186dd62d9ec",
        "https://polygon-mainnet.g.alchemy.com/v2/VOTRE_CLE_ALCHEMY_ICI", // IMPORTANT: Remplacez par votre véritable clé API Alchemy
        "https://your-quicknode-endpoint.matic.discover.quiknode.pro/your-key/" // EXEMPLE: Remplacez par votre URL QuickNode
    ],
};