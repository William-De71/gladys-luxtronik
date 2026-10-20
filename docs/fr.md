# Luxtronik

## Présentation

Cette intégration amène dans Gladys les pompes à chaleur équipées d’un régulateur **Luxtronik 2.0 ou 2.1**, sur votre réseau local, sans aucun cloud : Alpha Innotec, Novelan, Siemens, Buderus, Nibe AP, Roth, Elco, Wolf et les autres marques qui l’utilisent.

Gladys lit les températures, le mode de fonctionnement et l’état, le compresseur et l’appoint électrique, le journal d’erreurs, les compteurs de puissance et d’énergie quand le régulateur les fournit, et peut (seulement si vous l’autorisez) changer les modes chauffage et eau chaude, la « température +/- », la consigne d’eau chaude et le rafraîchissement.

Sans lien avec Alpha Innotec ni les marques citées.

![Les widgets « Pompe à chaleur », « Courbes de la PAC », « Énergie de la PAC » et « Journal de la PAC » (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-luxtronik/main/docs/assets/widgets.fr.png)

## Prérequis

- Gladys Assistant 5.1.0 ou plus récent.
- Le régulateur de la pompe à chaleur branché à votre réseau **par un câble** (Ethernet), sur le même réseau que Gladys.
- Une adresse IP fixe pour le régulateur (une réservation DHCP dans votre box). Elle s’affiche sur le régulateur, dans **Service > Information > Adresse IP**.
- Rien à installer sur le régulateur : Gladys utilise son port intégré 8889, celui des outils Alpha Innotec et des intégrations Home Assistant.

## Configuration

### Pompe à chaleur

Saisissez l’adresse IP du régulateur dans **Adresse de la pompe à chaleur** (plusieurs pompes à chaleur : séparez les adresses par des virgules ; ajoutez `:port` seulement si votre installateur a changé le port 8889), puis appuyez sur **Rechercher et tester les pompes à chaleur**.

**Chercher aussi sur le réseau** : Gladys envoie en plus le message de recherche Alpha Innotec sur les ports UDP 4444 et 47808. Tous les firmwares n’y répondent pas : l’adresse saisie est le moyen fiable.

**Intervalle de lecture** : à quelle fréquence le régulateur est lu, de 30 secondes à 5 minutes. Le régulateur supporte mal les demandes fréquentes : l’intégration n’ouvre qu’une connexion à la fois et la ferme après chaque lecture.

### Modifier les réglages

**Autoriser les modifications** est désactivé par défaut : Gladys ne fait que lire. Une fois la case cochée, les modes chauffage et eau chaude, la température +/-, la consigne d’eau chaude et le rafraîchissement se pilotent depuis Gladys. Chaque modification est écrite dans la mémoire du régulateur, qui s’use, donc l’intégration :

- n’écrit jamais une valeur déjà en place ;
- modifie un même réglage au plus toutes les 2 minutes, et 50 réglages par jour au maximum ;
- n’accepte que des valeurs dans des bornes sûres (eau chaude 30 à 65 °C, température +/- de −5 à +5 °C, rafraîchissement 18 à 30 °C) et refuse les autres ;
- relit la valeur après l’avoir écrite ;
- n’écrit jamais sur les firmwares V1.90.x et V2.90.x, qui plantent à la moindre modification (mettez d’abord le firmware à jour).

**Langue des noms et des textes** : la langue des noms des fonctionnalités, des modes et des messages d’erreur.

## Utilisation

### Appareils

Ouvrez l’onglet **Découverte** de l’intégration et ajoutez les appareils de la pompe à chaleur :

- **Pompe à chaleur** : températures extérieure (et extérieure moyenne), de départ, de retour, consigne de retour, gaz chauds, entrée et sortie de la source de chaleur, température ambiante avec une commande d’ambiance, mode de fonctionnement, état, dernière erreur, compresseur et appoint électrique (marche / arrêt), puissance électrique et électricité consommée, puissance thermique et chaleur produite (quand le régulateur les fournit), heures et démarrages du compresseur, heures de l’appoint.
- **Pompe à chaleur – chauffage** : mode chauffage (automatique, 2e générateur, party, vacances, arrêt) et température +/- (le décalage de la courbe de chauffe, comme sur le régulateur).
- **Pompe à chaleur – eau chaude** (si la pompe à chaleur produit l’eau chaude) : température, consigne, mode, production en cours.
- **Pompe à chaleur – rafraîchissement** (si elle peut rafraîchir) : rafraîchissement marche / arrêt (automatique) et sa consigne.

Ajoutez **Électricité consommée** au suivi de l’énergie de Gladys pour voir la consommation et le coût de la pompe à chaleur. **Chaleur produite** est la chaleur fournie (pas de l’électricité) : elle sert à l’historique.

### Widgets

- **Pompe à chaleur** : ce qu’elle fait maintenant : mode, état, compresseur, appoint, températures extérieure, de départ, de retour et d’eau chaude, puissance absorbée.
- **Courbes de la PAC** : températures extérieure, de départ, de retour et d’eau chaude sur 24 heures, 3 ou 7 jours (les appareils doivent être ajoutés).
- **Énergie de la PAC** : chaleur produite, électricité consommée, rendement (chaleur ÷ électricité depuis la mise en service), heures et démarrages du compresseur, heures de l’appoint.
- **Journal de la PAC** : les dernières erreurs et les derniers arrêts du compresseur, avec leurs dates.

### Scènes

Déclencheurs : **La pompe à chaleur signale une erreur** (une nouvelle entrée dans son journal, avec le code et sa signification), **La pompe à chaleur change de mode** (filtre sur le nouveau mode ou le précédent : chauffage, eau chaude, dégivrage, coupure fournisseur, rafraîchissement, pas de demande…), **L’appoint électrique démarre**, **L’appoint électrique s’arrête** (avec sa durée), **La pompe à chaleur ne répond plus** (3 minutes), **La pompe à chaleur répond de nouveau**.

Action : **Lire la pompe à chaleur** (mode, état, températures, consigne d’eau chaude, puissance, dernière erreur), pour un message ou une condition.

Exemples :

- La pompe à chaleur signale une erreur → envoyer une notification avec `{{triggerEvent.data.error_text}}`.
- L’appoint électrique démarre → envoyer un message : l’électricité coûte cher, vérifiez la pompe à chaleur.
- La pompe à chaleur passe en dégivrage → ne pas lancer la VMC de la salle de bain maintenant.

## Dépannage

- **« Aucune pompe à chaleur ne répond sur le port 8889 »** : vérifiez l’adresse IP sur le régulateur, le câble réseau, et que rien d’autre (un ancien outil, une autre domotique) ne garde une connexion ouverte : le régulateur accepte peu de clients.
- **La recherche réseau ne trouve rien** : normal avec certains firmwares ; saisissez l’adresse.
- **« Les modifications sont désactivées »** : cochez **Autoriser les modifications** dans les réglages.
- **« Le firmware … plante le régulateur »** : les firmwares V1.90 et V2.90 n’acceptent aucune modification par le réseau ; la lecture fonctionne.
- **Une valeur manque** (température ambiante, puissance, énergie) : votre régulateur ne la fournit pas ; une mise à jour du firmware l’ajoute parfois.
- Le bouton **Rechercher et tester les pompes à chaleur** liste ce que voit l’intégration ; l’onglet Logs de l’intégration en dit plus.

Signalez un problème sur [GitHub](https://github.com/William-De71/gladys-luxtronik/issues) avec votre version de Gladys, la version de l’intégration, le modèle de pompe à chaleur, le firmware du régulateur et les logs.
