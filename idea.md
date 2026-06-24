We hebben heel veel babykleding in verschillende maten en hierdoor mist het overzicht.
Een inventaris (PWA) app is hierbij gewenst.

Deze app moet:
- Scanner invoer: foto maken van kledingstuk, in-app -> maat aanklikken -> overige eigenschappen
  - Queue for AI. Ik heb een lokale ollama draaien waarop we met een heel licht model eigenschappen kunnen analyseren. De bovenliggende map is een ansible setup waarin ollama te vinden is en de connectie met de nuc staat om te testen welk model haalbaar is. Zet dan in 'processing state'
- Kledingkast: inventaris laten zien en zoeken en filteren
- Eigenschappen: Lang, kort, seizoen, kwaliteit, favoriet, notitie
- Verwijder, edit, ...
- Modern design, snel en efficient.
- Filtersets maken en vastzetten om altijd een "maat 56 zomer" te kunnen openen
- Moet draaien in de ansible setup, dockerfile (bovenliggende map)
- Cijfers en feitjes: hoeveel lange broeken hebben we in maat 64, waar zijn de gaten in de inventaris en moet nog geshopt worden.
- Foto's originelen bewaren maar compress voor snelle weergave. Download knop voor originele foto's.
- Ook op desktop te gebruiken, responsive design
- Items bij elkaar matchen om een outfit te maken. Bij elkaar zien, drag-drop en dan dus achtergrond van het item weg filteren. En deze outfits opslaan en bewaren. Transparant maken ook met ai? weinig processing power, alternatieven?
