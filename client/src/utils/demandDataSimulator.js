export const generateHistoricalData = () => {
  const crops = ['Wheat', 'Rice', 'Tomato'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 2;
  
  let data = [];
  
  // Base patterns for crops
  const patterns = {
    Wheat: { baseDemand: 1000, basePrice: 25, trend: 10, volatility: 50 },
    Rice: { baseDemand: 1200, basePrice: 40, trend: 5, volatility: 60 },
    Tomato: { baseDemand: 500, basePrice: 15, trend: 15, volatility: 80 }
  };
  
  crops.forEach(crop => {
    let currentDemand = patterns[crop].baseDemand;
    let currentPrice = patterns[crop].basePrice;
    
    for (let i = 0; i < 24; i++) {
        const yearOffset = Math.floor(i / 12);
        const monthIndex = i % 12;
        const monthLabel = `${months[monthIndex]} ${startYear + yearOffset}`;
        
        // Add some random noise and trend
        const noiseDemand = (Math.random() - 0.5) * patterns[crop].volatility;
        const noisePrice = (Math.random() - 0.5) * (patterns[crop].basePrice * 0.2);
        
        currentDemand += patterns[crop].trend + noiseDemand;
        currentPrice += (Math.random() * 0.5 - 0.1) + noisePrice;
        
        // Seasonality simulation (simple sine wave)
        const seasonality = Math.sin((i / 12) * Math.PI * 2) * (patterns[crop].baseDemand * 0.2);
        const finalDemand = Math.max(0, Math.round(currentDemand + seasonality));
        
        // Price inversely proportional to demand roughly
        const seasonalityPrice = -Math.sin((i / 12) * Math.PI * 2) * (patterns[crop].basePrice * 0.1);
        const finalPrice = Math.max(1, (currentPrice + seasonalityPrice).toFixed(2));
        
        let sentiment = 'Stable';
        if (finalDemand > patterns[crop].baseDemand * 1.2) sentiment = 'High';
        else if (finalDemand < patterns[crop].baseDemand * 0.8) sentiment = 'Low';

        data.push({
            monthIndex: i + 1, // 1-indexed for linear regression
            monthLabel,
            cropName: crop,
            historicalVolume: finalDemand,
            averagePrice: Number(finalPrice),
            marketSentiment: sentiment
        });
    }
  });

  return data;
};
