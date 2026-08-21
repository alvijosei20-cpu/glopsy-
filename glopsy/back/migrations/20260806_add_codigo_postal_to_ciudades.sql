-- Añadir columna codigo_postal a la tabla ciudades y actualizar códigos postales correspondientes

ALTER TABLE ciudades ADD COLUMN IF NOT EXISTS codigo_postal VARCHAR(20);

UPDATE ciudades SET codigo_postal = '910001' WHERE nombre = 'Leticia';
UPDATE ciudades SET codigo_postal = '912017' WHERE nombre = 'Puerto Nariño';

UPDATE ciudades SET codigo_postal = '050001' WHERE nombre = 'Medellín';
UPDATE ciudades SET codigo_postal = '050010' WHERE nombre = 'Bello';
UPDATE ciudades SET codigo_postal = '055410' WHERE nombre = 'Itagüí';
UPDATE ciudades SET codigo_postal = '055420' WHERE nombre = 'Envigado';
UPDATE ciudades SET codigo_postal = '054040' WHERE nombre = 'Rionegro';
UPDATE ciudades SET codigo_postal = '057840' WHERE nombre = 'Apartadó';
UPDATE ciudades SET codigo_postal = '057860' WHERE nombre = 'Turbo';
UPDATE ciudades SET codigo_postal = '055450' WHERE nombre = 'Sabaneta';

UPDATE ciudades SET codigo_postal = '810001' WHERE nombre = 'Arauca';
UPDATE ciudades SET codigo_postal = '812010' WHERE nombre = 'Saravena';
UPDATE ciudades SET codigo_postal = '813010' WHERE nombre = 'Tame';
UPDATE ciudades SET codigo_postal = '811010' WHERE nombre = 'Arauquita';

UPDATE ciudades SET codigo_postal = '080001' WHERE nombre = 'Barranquilla';
UPDATE ciudades SET codigo_postal = '081001' WHERE nombre = 'Soledad';
UPDATE ciudades SET codigo_postal = '081020' WHERE nombre = 'Malambo';
UPDATE ciudades SET codigo_postal = '081040' WHERE nombre = 'Puerto Colombia';
UPDATE ciudades SET codigo_postal = '085001' WHERE nombre = 'Sabanalarga';

UPDATE ciudades SET codigo_postal = '130001' WHERE nombre = 'Cartagena de Indias';
UPDATE ciudades SET codigo_postal = '135001' WHERE nombre = 'Magangué';
UPDATE ciudades SET codigo_postal = '131001' WHERE nombre = 'Turbaco';
UPDATE ciudades SET codigo_postal = '132001' WHERE nombre = 'Arjona';
UPDATE ciudades SET codigo_postal = '133001' WHERE nombre = 'El Carmen de Bolívar';

UPDATE ciudades SET codigo_postal = '150001' WHERE nombre = 'Tunja';
UPDATE ciudades SET codigo_postal = '150461' WHERE nombre = 'Duitama';
UPDATE ciudades SET codigo_postal = '151101' WHERE nombre = 'Sogamoso';
UPDATE ciudades SET codigo_postal = '154641' WHERE nombre = 'Chiquinquirá';
UPDATE ciudades SET codigo_postal = '154021' WHERE nombre = 'Puerto Boyacá';

UPDATE ciudades SET codigo_postal = '170001' WHERE nombre = 'Manizales';
UPDATE ciudades SET codigo_postal = '174031' WHERE nombre = 'La Dorada';
UPDATE ciudades SET codigo_postal = '172031' WHERE nombre = 'Chinchiná';
UPDATE ciudades SET codigo_postal = '172041' WHERE nombre = 'Villamaría';
UPDATE ciudades SET codigo_postal = '173041' WHERE nombre = 'Riosucio';

UPDATE ciudades SET codigo_postal = '180001' WHERE nombre = 'Florencia';
UPDATE ciudades SET codigo_postal = '182010' WHERE nombre = 'San Vicente del Caguán';
UPDATE ciudades SET codigo_postal = '183010' WHERE nombre = 'Puerto Rico';

UPDATE ciudades SET codigo_postal = '850001' WHERE nombre = 'Yopal';
UPDATE ciudades SET codigo_postal = '852010' WHERE nombre = 'Aguazul';
UPDATE ciudades SET codigo_postal = '853010' WHERE nombre = 'Villanueva';
UPDATE ciudades SET codigo_postal = '851010' WHERE nombre = 'Pore';

UPDATE ciudades SET codigo_postal = '190001' WHERE nombre = 'Popayán';
UPDATE ciudades SET codigo_postal = '191001' WHERE nombre = 'Santander de Quilichao';
UPDATE ciudades SET codigo_postal = '192001' WHERE nombre = 'Puerto Tejada';
UPDATE ciudades SET codigo_postal = '193001' WHERE nombre = 'Patía';

UPDATE ciudades SET codigo_postal = '200001' WHERE nombre = 'Valledupar';
UPDATE ciudades SET codigo_postal = '204001' WHERE nombre = 'Aguachica';
UPDATE ciudades SET codigo_postal = '202001' WHERE nombre = 'Codazzi';
UPDATE ciudades SET codigo_postal = '201001' WHERE nombre = 'Bosconia';

UPDATE ciudades SET codigo_postal = '270001' WHERE nombre = 'Quibdó';
UPDATE ciudades SET codigo_postal = '273001' WHERE nombre = 'Istmina';
UPDATE ciudades SET codigo_postal = '272001' WHERE nombre = 'Tadó';
UPDATE ciudades SET codigo_postal = '271001' WHERE nombre = 'Acandí';

UPDATE ciudades SET codigo_postal = '230001' WHERE nombre = 'Montería';
UPDATE ciudades SET codigo_postal = '231001' WHERE nombre = 'Cereté';
UPDATE ciudades SET codigo_postal = '232001' WHERE nombre = 'Sahagún';
UPDATE ciudades SET codigo_postal = '233001' WHERE nombre = 'Lorica';
UPDATE ciudades SET codigo_postal = '234001' WHERE nombre = 'Montelíbano';

UPDATE ciudades SET codigo_postal = '110011' WHERE nombre = 'Bogotá D.C.';
UPDATE ciudades SET codigo_postal = '250051' WHERE nombre = 'Soacha';
UPDATE ciudades SET codigo_postal = '252211' WHERE nombre = 'Fusagasugá';
UPDATE ciudades SET codigo_postal = '251411' WHERE nombre = 'Facatativá';
UPDATE ciudades SET codigo_postal = '250011' WHERE nombre = 'Chía';
UPDATE ciudades SET codigo_postal = '254011' WHERE nombre = 'Zipaquirá';
UPDATE ciudades SET codigo_postal = '253011' WHERE nombre = 'Girardot';
UPDATE ciudades SET codigo_postal = '250021' WHERE nombre = 'Mosquera';
UPDATE ciudades SET codigo_postal = '250031' WHERE nombre = 'Madrid';

UPDATE ciudades SET codigo_postal = '940001' WHERE nombre = 'Puerto Inírida';

UPDATE ciudades SET codigo_postal = '950001' WHERE nombre = 'San José del Guaviare';
UPDATE ciudades SET codigo_postal = '951010' WHERE nombre = 'Calamar';

UPDATE ciudades SET codigo_postal = '410001' WHERE nombre = 'Neiva';
UPDATE ciudades SET codigo_postal = '413001' WHERE nombre = 'Pitalito';
UPDATE ciudades SET codigo_postal = '412001' WHERE nombre = 'Garzón';
UPDATE ciudades SET codigo_postal = '411001' WHERE nombre = 'La Plata';

UPDATE ciudades SET codigo_postal = '440001' WHERE nombre = 'Riohacha';
UPDATE ciudades SET codigo_postal = '442001' WHERE nombre = 'Maicao';
UPDATE ciudades SET codigo_postal = '443001' WHERE nombre = 'Uribia';
UPDATE ciudades SET codigo_postal = '441001' WHERE nombre = 'Fonseca';

UPDATE ciudades SET codigo_postal = '470001' WHERE nombre = 'Santa Marta';
UPDATE ciudades SET codigo_postal = '472001' WHERE nombre = 'Ciénaga';
UPDATE ciudades SET codigo_postal = '471001' WHERE nombre = 'Fundación';
UPDATE ciudades SET codigo_postal = '473001' WHERE nombre = 'El Banco';

UPDATE ciudades SET codigo_postal = '500001' WHERE nombre = 'Villavicencio';
UPDATE ciudades SET codigo_postal = '502011' WHERE nombre = 'Acacías';
UPDATE ciudades SET codigo_postal = '503011' WHERE nombre = 'Granada';
UPDATE ciudades SET codigo_postal = '504011' WHERE nombre = 'Puerto López';

UPDATE ciudades SET codigo_postal = '520001' WHERE nombre = 'Pasto';
UPDATE ciudades SET codigo_postal = '523001' WHERE nombre = 'Tumaco';
UPDATE ciudades SET codigo_postal = '522001' WHERE nombre = 'Ipiales';
UPDATE ciudades SET codigo_postal = '521001' WHERE nombre = 'Túquerres';

UPDATE ciudades SET codigo_postal = '540001' WHERE nombre = 'Cúcuta';
UPDATE ciudades SET codigo_postal = '543001' WHERE nombre = 'Ocaña';
UPDATE ciudades SET codigo_postal = '542001' WHERE nombre = 'Pamplona';
UPDATE ciudades SET codigo_postal = '541001' WHERE nombre = 'Villa del Rosario';
UPDATE ciudades SET codigo_postal = '541021' WHERE nombre = 'Los Patios';

UPDATE ciudades SET codigo_postal = '860001' WHERE nombre = 'Mocoa';
UPDATE ciudades SET codigo_postal = '861001' WHERE nombre = 'Puerto Asís';
UPDATE ciudades SET codigo_postal = '862001' WHERE nombre = 'Orito';

UPDATE ciudades SET codigo_postal = '630001' WHERE nombre = 'Armenia';
UPDATE ciudades SET codigo_postal = '632001' WHERE nombre = 'Calarcá';
UPDATE ciudades SET codigo_postal = '631001' WHERE nombre = 'Tebaida';
UPDATE ciudades SET codigo_postal = '633001' WHERE nombre = 'Montenegro';

UPDATE ciudades SET codigo_postal = '660001' WHERE nombre = 'Pereira';
UPDATE ciudades SET codigo_postal = '661001' WHERE nombre = 'Dosquebradas';
UPDATE ciudades SET codigo_postal = '662001' WHERE nombre = 'Santa Rosa de Cabal';
UPDATE ciudades SET codigo_postal = '663001' WHERE nombre = 'La Virginia';

UPDATE ciudades SET codigo_postal = '880001' WHERE nombre = 'San Andrés';
UPDATE ciudades SET codigo_postal = '880002' WHERE nombre = 'Providencia';

UPDATE ciudades SET codigo_postal = '680001' WHERE nombre = 'Bucaramanga';
UPDATE ciudades SET codigo_postal = '681001' WHERE nombre = 'Floridablanca';
UPDATE ciudades SET codigo_postal = '682001' WHERE nombre = 'Girón';
UPDATE ciudades SET codigo_postal = '683001' WHERE nombre = 'Piedecuesta';
UPDATE ciudades SET codigo_postal = '684001' WHERE nombre = 'Barrancabermeja';
UPDATE ciudades SET codigo_postal = '685001' WHERE nombre = 'San Gil';

UPDATE ciudades SET codigo_postal = '700001' WHERE nombre = 'Sincelejo';
UPDATE ciudades SET codigo_postal = '701001' WHERE nombre = 'Corozal';
UPDATE ciudades SET codigo_postal = '702001' WHERE nombre = 'San Marcos';
UPDATE ciudades SET codigo_postal = '703001' WHERE nombre = 'Tolú';

UPDATE ciudades SET codigo_postal = '730001' WHERE nombre = 'Ibagué';
UPDATE ciudades SET codigo_postal = '732001' WHERE nombre = 'Espinal';
UPDATE ciudades SET codigo_postal = '733001' WHERE nombre = 'Melgar';
UPDATE ciudades SET codigo_postal = '731001' WHERE nombre = 'Lérida';

UPDATE ciudades SET codigo_postal = '760001' WHERE nombre = 'Cali';
UPDATE ciudades SET codigo_postal = '763001' WHERE nombre = 'Palmira';
UPDATE ciudades SET codigo_postal = '762001' WHERE nombre = 'Buenaventura';
UPDATE ciudades SET codigo_postal = '764001' WHERE nombre = 'Tuluá';
UPDATE ciudades SET codigo_postal = '765001' WHERE nombre = 'Buga';
UPDATE ciudades SET codigo_postal = '766001' WHERE nombre = 'Cartago';
UPDATE ciudades SET codigo_postal = '767001' WHERE nombre = 'Jamundí';
UPDATE ciudades SET codigo_postal = '768001' WHERE nombre = 'Yumbo';

UPDATE ciudades SET codigo_postal = '970001' WHERE nombre = 'Mitú';

UPDATE ciudades SET codigo_postal = '990001' WHERE nombre = 'Puerto Carreño';
UPDATE ciudades SET codigo_postal = '991010' WHERE nombre = 'La Primavera';

-- Asegurar valor por defecto para cualquier otra ciudad que no coincida exactamente
UPDATE ciudades SET codigo_postal = '110011' WHERE codigo_postal IS NULL;
