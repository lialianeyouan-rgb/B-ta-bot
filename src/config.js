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

// ###################################################################################
// #                                                                                 #
// #    !!!   MISE À JOUR DE SÉCURITÉ IMPORTANTE   !!!                               #
// #                                                                                 #
// #    Les clés sensibles (Clé API Gemini, Clé Privée, URLs RPC) ont été            #
// #    retirées de ce fichier. Elles doivent maintenant être placées dans un        #
// #    fichier nommé `.env` à la racine de votre projet. C'est une pratique         #
// #    essentielle pour la sécurité.                                                #
// #                                                                                 #
// #    Créez un fichier `.env` et ajoutez les lignes suivantes :                    #
// #                                                                                 #
// #    GEMINI_API_KEY="AIzaSy...VotreClé...QiA"                                     #
// #    PRIVATE_KEY="0x5492...VotreClé...c7"                                         #
// #    RPC_URL_1="https://polygon-mainnet.infura.io/v3/VOTRE_ID_INFURA"             #
// #    RPC_URL_2="https://polygon-mainnet.g.alchemy.com/v2/VOTRE_CLE_ALCHEMY"       #
// #    RPC_URL_3="https://...votre-noeud-prive.../"                                 #
// #                                                                                 #
// #    NE PARTAGEZ JAMAIS VOTRE FICHIER `.env`.                                     #
// #                                                                                 #
// ###################################################################################

module.exports = {
    // Ce fichier est intentionnellement laissé presque vide.
    // La configuration de la stratégie de trading se trouve dans `src/config.json`.
    // Les clés et les points de terminaison sont dans `.env`.
};
