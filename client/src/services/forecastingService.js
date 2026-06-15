export const forecastDemand = (historicalData) => {
    if (!historicalData || historicalData.length === 0) return [];
    
    const n = historicalData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    historicalData.forEach(point => {
        sumX += point.monthIndex;
        sumY += point.historicalVolume;
        sumXY += point.monthIndex * point.historicalVolume;
        sumXX += point.monthIndex * point.monthIndex;
    });
    
    // Calculate slope (m) and intercept (b)
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const forecasts = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Get last data point's date info to continue the month labels
    const lastPoint = historicalData[n - 1];
    let lastMonthStr = lastPoint.monthLabel.split(' ')[0];
    let lastYear = parseInt(lastPoint.monthLabel.split(' ')[1]);
    let lastMonthIdx = months.indexOf(lastMonthStr);
    
    for (let i = 1; i <= 6; i++) {
        const nextX = lastPoint.monthIndex + i;
        const predictedDemand = Math.max(0, Math.round(slope * nextX + intercept));
        
        // Advance month and year
        lastMonthIdx++;
        if (lastMonthIdx > 11) {
            lastMonthIdx = 0;
            lastYear++;
        }
        
        const nextMonthLabel = `${months[lastMonthIdx]} ${lastYear}`;
        
        let sentiment = 'Stable';
        const avgHistorical = sumY / n;
        if (predictedDemand > avgHistorical * 1.1) sentiment = 'High';
        else if (predictedDemand < avgHistorical * 0.9) sentiment = 'Low';
        
        forecasts.push({
            monthIndex: nextX,
            monthLabel: nextMonthLabel,
            cropName: lastPoint.cropName,
            historicalVolume: null, // null for forecast points 
            forecastVolume: predictedDemand,
            marketSentiment: sentiment
        });
    }
    
    return forecasts;
};
