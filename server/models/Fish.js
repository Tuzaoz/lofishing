// Definição de tipos de peixes
const FISH_TYPES = [
    {
        id: 'common_1',
        name: 'Lambari',
        rarity: 'comum',
        points: 10,
        minTime: 2000,
        maxTime: 5000,
        probability: 0.7
    },
    {
        id: 'common_2',
        name: 'Tilápia',
        rarity: 'comum',
        points: 15,
        minTime: 3000,
        maxTime: 6000,
        probability: 0.6
    },
    {
        id: 'uncommon_1',
        name: 'Tucunaré',
        rarity: 'incomum',
        points: 30,
        minTime: 5000,
        maxTime: 8000,
        probability: 0.3
    },
    {
        id: 'uncommon_2',
        name: 'Traíra',
        rarity: 'incomum',
        points: 35,
        minTime: 5000,
        maxTime: 9000,
        probability: 0.25
    },
    {
        id: 'rare_1',
        name: 'Dourado',
        rarity: 'raro',
        points: 60,
        minTime: 7000,
        maxTime: 12000,
        probability: 0.15
    },
    {
        id: 'rare_2',
        name: 'Pirarucu',
        rarity: 'raro',
        points: 80,
        minTime: 8000,
        maxTime: 15000,
        probability: 0.1
    },
    {
        id: 'legendary_1',
        name: 'Jaú Gigante',
        rarity: 'lendário',
        points: 150,
        minTime: 10000,
        maxTime: 20000,
        probability: 0.05
    }
];

function getRandomFishType() {
    // Sorteia um tipo de peixe com base na raridade/probabilidade
    const randomValue = Math.random();
    let cumulativeProbability = 0;
    
    for (const fishType of FISH_TYPES) {
        cumulativeProbability += fishType.probability;
        if (randomValue <= cumulativeProbability) {
            return fishType;
        }
    }
    
    // Caso de fallback, retorna o mais comum
    return FISH_TYPES[0];
}

module.exports = {
    FISH_TYPES,
    getRandomFishType
}; 