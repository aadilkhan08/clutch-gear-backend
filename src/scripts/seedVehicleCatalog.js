/**
 * Vehicle Catalog Seed Script
 * Populates the VehicleCatalog collection with comprehensive Indian-market
 * brand / model data.  Run with:
 *   node src/scripts/seedVehicleCatalog.js
 *
 * Uses upsert so it's safe to run multiple times.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const config = require("../config");
const VehicleCatalog = require("../models/vehicleCatalog.model");

// ─── Cars ────────────────────────────────────────────────────────────────────

const CAR_BRANDS = [
    {
        brand: "Maruti Suzuki",
        popular: true,
        models: [
            { name: "Alto K10", popular: true },
            { name: "Alto 800" },
            { name: "S-Presso" },
            { name: "Celerio" },
            { name: "WagonR", popular: true },
            { name: "Swift", popular: true },
            { name: "Dzire", popular: true },
            { name: "Baleno", popular: true },
            { name: "Ignis" },
            { name: "Ciaz" },
            { name: "Ertiga", popular: true },
            { name: "XL6" },
            { name: "Brezza", popular: true },
            { name: "Grand Vitara", popular: true },
            { name: "Fronx" },
            { name: "Jimny" },
            { name: "Invicto" },
            { name: "Eeco" },
            { name: "Omni" },
        ],
    },
    {
        brand: "Hyundai",
        popular: true,
        models: [
            { name: "i10 Grand", popular: true },
            { name: "i20", popular: true },
            { name: "i20 N Line" },
            { name: "Aura" },
            { name: "Venue", popular: true },
            { name: "Verna", popular: true },
            { name: "Creta", popular: true },
            { name: "Alcazar" },
            { name: "Tucson" },
            { name: "Exter" },
            { name: "Ioniq 5" },
            { name: "Kona Electric" },
            { name: "Santro" },
            { name: "Xcent" },
            { name: "Elite i20" },
        ],
    },
    {
        brand: "Tata",
        popular: true,
        models: [
            { name: "Tiago", popular: true },
            { name: "Tigor" },
            { name: "Punch", popular: true },
            { name: "Nexon", popular: true },
            { name: "Nexon EV" },
            { name: "Harrier", popular: true },
            { name: "Safari", popular: true },
            { name: "Altroz" },
            { name: "Nano" },
            { name: "Bolt" },
            { name: "Zest" },
            { name: "Hexa" },
            { name: "Indica" },
            { name: "Indigo" },
            { name: "Sumo" },
            { name: "Tiago EV" },
            { name: "Curvv" },
            { name: "Curvv EV" },
        ],
    },
    {
        brand: "Mahindra",
        popular: true,
        models: [
            { name: "Thar", popular: true },
            { name: "XUV700", popular: true },
            { name: "XUV400" },
            { name: "XUV300", popular: true },
            { name: "Scorpio N", popular: true },
            { name: "Scorpio Classic" },
            { name: "Bolero", popular: true },
            { name: "Bolero Neo" },
            { name: "Marazzo" },
            { name: "KUV100" },
            { name: "XUV500" },
            { name: "Xylo" },
            { name: "Verito" },
            { name: "TUV300" },
            { name: "BE 6" },
            { name: "XEV 9e" },
        ],
    },
    {
        brand: "Kia",
        popular: true,
        models: [
            { name: "Seltos", popular: true },
            { name: "Sonet", popular: true },
            { name: "Carens", popular: true },
            { name: "EV6" },
            { name: "EV9" },
            { name: "Carnival" },
        ],
    },
    {
        brand: "Toyota",
        popular: true,
        models: [
            { name: "Glanza" },
            { name: "Urban Cruiser Hyryder", popular: true },
            { name: "Innova Crysta", popular: true },
            { name: "Innova Hycross", popular: true },
            { name: "Fortuner", popular: true },
            { name: "Fortuner Legender" },
            { name: "Hilux" },
            { name: "Camry" },
            { name: "Vellfire" },
            { name: "Land Cruiser" },
            { name: "Etios" },
            { name: "Yaris" },
            { name: "Rumion" },
            { name: "Taisor" },
        ],
    },
    {
        brand: "Honda",
        popular: true,
        models: [
            { name: "Amaze", popular: true },
            { name: "City", popular: true },
            { name: "City Hybrid" },
            { name: "Elevate", popular: true },
            { name: "WR-V" },
            { name: "Jazz" },
            { name: "Civic" },
            { name: "CR-V" },
            { name: "BR-V" },
            { name: "Brio" },
        ],
    },
    {
        brand: "MG",
        popular: true,
        models: [
            { name: "Hector", popular: true },
            { name: "Hector Plus" },
            { name: "Astor" },
            { name: "ZS EV", popular: true },
            { name: "Gloster" },
            { name: "Comet EV" },
            { name: "Windsor EV" },
        ],
    },
    {
        brand: "Volkswagen",
        models: [
            { name: "Polo" },
            { name: "Vento" },
            { name: "Taigun", popular: true },
            { name: "Virtus", popular: true },
            { name: "Tiguan" },
            { name: "T-Roc" },
        ],
    },
    {
        brand: "Skoda",
        models: [
            { name: "Slavia", popular: true },
            { name: "Kushaq", popular: true },
            { name: "Superb" },
            { name: "Octavia" },
            { name: "Kodiaq" },
            { name: "Rapid" },
        ],
    },
    {
        brand: "Renault",
        models: [
            { name: "Kwid", popular: true },
            { name: "Triber" },
            { name: "Kiger", popular: true },
            { name: "Duster" },
        ],
    },
    {
        brand: "Nissan",
        models: [
            { name: "Magnite", popular: true },
            { name: "Kicks" },
            { name: "X-Trail" },
        ],
    },
    {
        brand: "Citroen",
        models: [
            { name: "C3" },
            { name: "C3 Aircross" },
            { name: "eC3" },
            { name: "C5 Aircross" },
        ],
    },
    {
        brand: "Jeep",
        models: [
            { name: "Compass", popular: true },
            { name: "Meridian" },
            { name: "Wrangler" },
            { name: "Grand Cherokee" },
        ],
    },
    {
        brand: "Ford",
        models: [
            { name: "EcoSport" },
            { name: "Endeavour" },
            { name: "Figo" },
            { name: "Aspire" },
            { name: "Freestyle" },
        ],
    },
    {
        brand: "Chevrolet",
        models: [
            { name: "Beat" },
            { name: "Spark" },
            { name: "Cruze" },
            { name: "Sail" },
            { name: "Tavera" },
            { name: "Enjoy" },
        ],
    },
    {
        brand: "BMW",
        models: [
            { name: "3 Series", popular: true },
            { name: "5 Series" },
            { name: "7 Series" },
            { name: "X1", popular: true },
            { name: "X3" },
            { name: "X5" },
            { name: "X7" },
            { name: "iX" },
            { name: "i4" },
            { name: "2 Series Gran Coupe" },
        ],
    },
    {
        brand: "Mercedes-Benz",
        models: [
            { name: "A-Class" },
            { name: "C-Class", popular: true },
            { name: "E-Class", popular: true },
            { name: "S-Class" },
            { name: "GLA" },
            { name: "GLB" },
            { name: "GLC" },
            { name: "GLE" },
            { name: "GLS" },
            { name: "EQS" },
            { name: "AMG GT" },
        ],
    },
    {
        brand: "Audi",
        models: [
            { name: "A4", popular: true },
            { name: "A6" },
            { name: "A8" },
            { name: "Q3" },
            { name: "Q5", popular: true },
            { name: "Q7" },
            { name: "Q8" },
            { name: "e-tron" },
            { name: "RS5" },
        ],
    },
    {
        brand: "Volvo",
        models: [
            { name: "XC40" },
            { name: "XC60" },
            { name: "XC90" },
            { name: "S60" },
            { name: "S90" },
            { name: "C40 Recharge" },
        ],
    },
    {
        brand: "Land Rover",
        models: [
            { name: "Defender" },
            { name: "Discovery Sport" },
            { name: "Range Rover Evoque" },
            { name: "Range Rover Velar" },
            { name: "Range Rover Sport" },
            { name: "Range Rover" },
        ],
    },
    {
        brand: "Porsche",
        models: [
            { name: "Cayenne" },
            { name: "Macan" },
            { name: "Taycan" },
            { name: "911" },
        ],
    },
    {
        brand: "Lexus",
        models: [
            { name: "ES" },
            { name: "NX" },
            { name: "RX" },
            { name: "LS" },
            { name: "LX" },
            { name: "LC" },
        ],
    },
    {
        brand: "BYD",
        models: [
            { name: "Atto 3" },
            { name: "Seal" },
            { name: "e6" },
        ],
    },
    {
        brand: "Isuzu",
        models: [
            { name: "D-Max V-Cross" },
            { name: "mu-X" },
            { name: "S-Cab" },
        ],
    },
    {
        brand: "Datsun",
        models: [
            { name: "GO" },
            { name: "GO Plus" },
            { name: "redi-GO" },
        ],
    },
    {
        brand: "Fiat",
        models: [
            { name: "Punto" },
            { name: "Linea" },
            { name: "Avventura" },
        ],
    },
    {
        brand: "Hindustan Motors",
        models: [
            { name: "Ambassador" },
            { name: "Contessa" },
        ],
    },
];

// ─── Bikes ───────────────────────────────────────────────────────────────────

const BIKE_BRANDS = [
    {
        brand: "Hero",
        popular: true,
        models: [
            { name: "Splendor Plus", popular: true },
            { name: "Splendor iSmart" },
            { name: "HF Deluxe", popular: true },
            { name: "Passion Pro" },
            { name: "Passion Xtec" },
            { name: "Glamour", popular: true },
            { name: "Super Splendor" },
            { name: "Xpulse 200" },
            { name: "Xpulse 200 4V" },
            { name: "Xtreme 160R", popular: true },
            { name: "Xtreme 200S" },
            { name: "Karizma XMR" },
            { name: "Mavrick 440" },
            { name: "CD Deluxe" },
        ],
    },
    {
        brand: "Honda",
        popular: true,
        models: [
            { name: "Shine", popular: true },
            { name: "SP 125", popular: true },
            { name: "Unicorn", popular: true },
            { name: "Hornet 2.0" },
            { name: "CB200X" },
            { name: "CB300R" },
            { name: "CB300F" },
            { name: "CB350", popular: true },
            { name: "CB350RS" },
            { name: "CB500X" },
            { name: "Livo" },
            { name: "Dream" },
            { name: "Africa Twin" },
            { name: "Gold Wing" },
        ],
    },
    {
        brand: "Bajaj",
        popular: true,
        models: [
            { name: "Pulsar 125" },
            { name: "Pulsar 150", popular: true },
            { name: "Pulsar NS160" },
            { name: "Pulsar NS200", popular: true },
            { name: "Pulsar RS200" },
            { name: "Pulsar 220F" },
            { name: "Pulsar N250" },
            { name: "Pulsar F250" },
            { name: "Dominar 250" },
            { name: "Dominar 400", popular: true },
            { name: "Avenger Cruise 220" },
            { name: "Avenger Street 160" },
            { name: "Platina" },
            { name: "CT 110" },
            { name: "CT 125X" },
            { name: "Triumph Scrambler 400" },
            { name: "Triumph Speed 400" },
        ],
    },
    {
        brand: "TVS",
        popular: true,
        models: [
            { name: "Apache RTR 160", popular: true },
            { name: "Apache RTR 160 4V", popular: true },
            { name: "Apache RTR 200 4V" },
            { name: "Apache RR 310" },
            { name: "Raider 125", popular: true },
            { name: "Ronin" },
            { name: "Star City Plus" },
            { name: "Radeon" },
            { name: "Sport" },
        ],
    },
    {
        brand: "Royal Enfield",
        popular: true,
        models: [
            { name: "Classic 350", popular: true },
            { name: "Bullet 350", popular: true },
            { name: "Meteor 350", popular: true },
            { name: "Hunter 350", popular: true },
            { name: "Himalayan", popular: true },
            { name: "Continental GT 650" },
            { name: "Interceptor 650", popular: true },
            { name: "Super Meteor 650" },
            { name: "Shotgun 650" },
            { name: "Guerrilla 450" },
            { name: "Scram 411" },
            { name: "Thunderbird" },
            { name: "Electra" },
        ],
    },
    {
        brand: "Yamaha",
        popular: true,
        models: [
            { name: "FZ-S FI V4", popular: true },
            { name: "FZ-X" },
            { name: "FZS 25" },
            { name: "MT-15 V2", popular: true },
            { name: "R15 V4", popular: true },
            { name: "R15S" },
            { name: "R3" },
            { name: "R7" },
            { name: "Fascino" },
            { name: "RayZR" },
        ],
    },
    {
        brand: "Suzuki",
        popular: true,
        models: [
            { name: "Gixxer 150", popular: true },
            { name: "Gixxer 250" },
            { name: "Gixxer SF" },
            { name: "Gixxer SF 250" },
            { name: "V-Strom SX" },
            { name: "Hayabusa" },
            { name: "Intruder" },
        ],
    },
    {
        brand: "KTM",
        popular: true,
        models: [
            { name: "Duke 125" },
            { name: "Duke 200", popular: true },
            { name: "Duke 250" },
            { name: "Duke 390", popular: true },
            { name: "RC 125" },
            { name: "RC 200" },
            { name: "RC 390" },
            { name: "Adventure 250" },
            { name: "Adventure 390", popular: true },
            { name: "390 Enduro R" },
        ],
    },
    {
        brand: "Kawasaki",
        models: [
            { name: "Ninja 300", popular: true },
            { name: "Ninja 400" },
            { name: "Ninja 650" },
            { name: "Ninja ZX-10R" },
            { name: "Z650" },
            { name: "Z900" },
            { name: "Versys 650" },
            { name: "Vulcan S" },
            { name: "W175" },
            { name: "Eliminator" },
        ],
    },
    {
        brand: "Husqvarna",
        models: [
            { name: "Svartpilen 250" },
            { name: "Vitpilen 250" },
            { name: "Svartpilen 401" },
        ],
    },
    {
        brand: "Jawa",
        models: [
            { name: "Jawa 42", popular: true },
            { name: "Jawa Classic" },
            { name: "Perak" },
            { name: "42 Bobber" },
            { name: "350" },
        ],
    },
    {
        brand: "Yezdi",
        models: [
            { name: "Roadster" },
            { name: "Scrambler" },
            { name: "Adventure" },
        ],
    },
    {
        brand: "Harley-Davidson",
        models: [
            { name: "X440", popular: true },
            { name: "Iron 883" },
            { name: "Fat Boy" },
            { name: "Street Glide" },
            { name: "Road King" },
            { name: "Pan America" },
            { name: "Nightster" },
        ],
    },
    {
        brand: "Triumph",
        models: [
            { name: "Speed 400", popular: true },
            { name: "Scrambler 400 X", popular: true },
            { name: "Tiger Sport 660" },
            { name: "Trident 660" },
            { name: "Speed Triple" },
            { name: "Street Triple" },
            { name: "Bonneville" },
            { name: "Rocket 3" },
        ],
    },
    {
        brand: "BMW Motorrad",
        models: [
            { name: "G 310 R" },
            { name: "G 310 GS" },
            { name: "F 850 GS" },
            { name: "R 1250 GS" },
            { name: "S 1000 RR" },
        ],
    },
    {
        brand: "Ducati",
        models: [
            { name: "Panigale V2" },
            { name: "Panigale V4" },
            { name: "Monster" },
            { name: "Scrambler" },
            { name: "Multistrada" },
        ],
    },
    {
        brand: "Benelli",
        models: [
            { name: "TNT 300" },
            { name: "Leoncino 250" },
            { name: "502C" },
            { name: "TRK 502X" },
            { name: "Imperiale 400" },
        ],
    },
    {
        brand: "Ola Electric",
        models: [
            { name: "Roadster" },
            { name: "Roadster X" },
            { name: "Roadster Pro" },
            { name: "Diamondhead" },
            { name: "Adventure" },
        ],
    },
    {
        brand: "Revolt",
        models: [
            { name: "RV400", popular: true },
            { name: "RV300" },
        ],
    },
];

// ─── Scooters ────────────────────────────────────────────────────────────────

const SCOOTER_BRANDS = [
    {
        brand: "Honda",
        popular: true,
        models: [
            { name: "Activa 6G", popular: true },
            { name: "Activa 125", popular: true },
            { name: "Dio", popular: true },
            { name: "Grazia" },
            { name: "Shine" },
        ],
    },
    {
        brand: "TVS",
        popular: true,
        models: [
            { name: "Jupiter", popular: true },
            { name: "Jupiter 125" },
            { name: "Ntorq 125", popular: true },
            { name: "iQube Electric", popular: true },
            { name: "Scooty Pep Plus" },
            { name: "Scooty Zest" },
        ],
    },
    {
        brand: "Suzuki",
        popular: true,
        models: [
            { name: "Access 125", popular: true },
            { name: "Burgman Street", popular: true },
            { name: "Avenis" },
        ],
    },
    {
        brand: "Hero",
        popular: true,
        models: [
            { name: "Maestro Edge", popular: true },
            { name: "Pleasure Plus", popular: true },
            { name: "Destini 125" },
            { name: "Xoom" },
            { name: "Vida V1 Electric" },
        ],
    },
    {
        brand: "Yamaha",
        popular: true,
        models: [
            { name: "Fascino 125", popular: true },
            { name: "RayZR 125", popular: true },
            { name: "Aerox 155" },
        ],
    },
    {
        brand: "Bajaj",
        models: [
            { name: "Chetak", popular: true },
        ],
    },
    {
        brand: "Ola Electric",
        popular: true,
        models: [
            { name: "S1 Pro", popular: true },
            { name: "S1 Air" },
            { name: "S1 X" },
        ],
    },
    {
        brand: "Ather",
        popular: true,
        models: [
            { name: "450X", popular: true },
            { name: "450S" },
            { name: "Rizta" },
        ],
    },
    {
        brand: "Ampere",
        models: [
            { name: "Nexus" },
            { name: "Primus" },
            { name: "Magnus EX" },
        ],
    },
    {
        brand: "Bounce",
        models: [
            { name: "Infinity E1" },
        ],
    },
    {
        brand: "Vespa",
        models: [
            { name: "VXL 150" },
            { name: "SXL 150" },
            { name: "ZX 125" },
            { name: "Elegante" },
        ],
    },
    {
        brand: "Aprilia",
        models: [
            { name: "SXR 125" },
            { name: "SXR 160" },
            { name: "Storm 125" },
        ],
    },
];

// ─── Autos ───────────────────────────────────────────────────────────────────

const AUTO_BRANDS = [
    {
        brand: "Bajaj",
        popular: true,
        models: [
            { name: "RE Compact", popular: true },
            { name: "RE 4S" },
            { name: "Maxima C" },
            { name: "Maxima Z" },
        ],
    },
    {
        brand: "TVS",
        popular: true,
        models: [
            { name: "King Kargo" },
            { name: "King Deluxe" },
        ],
    },
    {
        brand: "Piaggio",
        popular: true,
        models: [
            { name: "Ape City", popular: true },
            { name: "Ape Auto DX" },
            { name: "Ape E-City" },
        ],
    },
    {
        brand: "Mahindra",
        models: [
            { name: "Alfa" },
            { name: "Treo" },
            { name: "Treo Zor" },
            { name: "e-Alfa Mini" },
        ],
    },
];

// ─── Trucks ──────────────────────────────────────────────────────────────────

const TRUCK_BRANDS = [
    {
        brand: "Tata",
        popular: true,
        models: [
            { name: "Ace", popular: true },
            { name: "Ace Gold" },
            { name: "Intra V10" },
            { name: "Intra V30" },
            { name: "Yodha" },
            { name: "407" },
            { name: "709" },
            { name: "712" },
            { name: "LPT 1613" },
            { name: "Prima" },
            { name: "Signa" },
        ],
    },
    {
        brand: "Mahindra",
        popular: true,
        models: [
            { name: "Bolero Pickup", popular: true },
            { name: "Supro" },
            { name: "Jayo" },
            { name: "Furio" },
            { name: "Blazo" },
        ],
    },
    {
        brand: "Ashok Leyland",
        popular: true,
        models: [
            { name: "Dost", popular: true },
            { name: "Partner" },
            { name: "Bada Dost" },
            { name: "Ecomet" },
            { name: "Boss" },
            { name: "Captain" },
        ],
    },
    {
        brand: "Eicher",
        models: [
            { name: "Pro 2049" },
            { name: "Pro 3015" },
            { name: "Pro 1059" },
        ],
    },
    {
        brand: "BharatBenz",
        models: [
            { name: "1015R" },
            { name: "1415R" },
            { name: "2823R" },
        ],
    },
    {
        brand: "Force Motors",
        models: [
            { name: "Traveller" },
            { name: "Gurkha" },
        ],
    },
    {
        brand: "Maruti Suzuki",
        models: [
            { name: "Super Carry" },
        ],
    },
];

// ─── Buses ───────────────────────────────────────────────────────────────────

const BUS_BRANDS = [
    {
        brand: "Tata",
        popular: true,
        models: [
            { name: "Starbus" },
            { name: "LP 912" },
            { name: "LP 1512" },
            { name: "Ultra" },
        ],
    },
    {
        brand: "Ashok Leyland",
        popular: true,
        models: [
            { name: "Viking" },
            { name: "Lynx" },
            { name: "Oyster" },
            { name: "Sunshine" },
        ],
    },
    {
        brand: "Eicher",
        models: [
            { name: "Skyline Pro" },
            { name: "Starline" },
        ],
    },
    {
        brand: "BharatBenz",
        models: [
            { name: "917" },
            { name: "1624" },
        ],
    },
    {
        brand: "Volvo",
        models: [
            { name: "9400" },
            { name: "9600" },
            { name: "B7R" },
            { name: "B8R" },
        ],
    },
    {
        brand: "Force Motors",
        models: [
            { name: "Traveller 26" },
            { name: "Traveller 3700" },
        ],
    },
];

// ─── Seed Runner ─────────────────────────────────────────────────────────────

const ALL_DATA = [
    { vehicleType: "car", brands: CAR_BRANDS },
    { vehicleType: "bike", brands: BIKE_BRANDS },
    { vehicleType: "scooter", brands: SCOOTER_BRANDS },
    { vehicleType: "auto", brands: AUTO_BRANDS },
    { vehicleType: "truck", brands: TRUCK_BRANDS },
    { vehicleType: "bus", brands: BUS_BRANDS },
];

async function seed() {
    try {
        await mongoose.connect(config.mongodb.uri);
        console.log("🔗  Connected to MongoDB");

        let upserted = 0;
        for (const { vehicleType, brands } of ALL_DATA) {
            for (const entry of brands) {
                await VehicleCatalog.findOneAndUpdate(
                    { vehicleType, brand: entry.brand },
                    {
                        vehicleType,
                        brand: entry.brand,
                        popular: entry.popular || false,
                        models: entry.models.map((m) => ({
                            name: m.name,
                            popular: m.popular || false,
                        })),
                        isActive: true,
                    },
                    { upsert: true, new: true }
                );
                upserted++;
            }
        }

        console.log(`✅  Seeded ${upserted} vehicle-catalog entries`);
        process.exit(0);
    } catch (err) {
        console.error("❌  Seed failed:", err);
        process.exit(1);
    }
}

seed();
