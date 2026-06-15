import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Spinner, Alert, Row, Col } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { generateHistoricalData } from '../utils/demandDataSimulator';
import { forecastDemand } from '../services/forecastingService';

const DemandForecast = () => {
    const [selectedCrop, setSelectedCrop] = useState('Wheat');
    const [chartData, setChartData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [insight, setInsight] = useState('');

    useEffect(() => {
        setIsLoading(true);
        // Simulate AI processing delay
        const timer = setTimeout(() => {
            const allHistorical = generateHistoricalData();
            const cropHistorical = allHistorical.filter(d => d.cropName === selectedCrop);
            
            const forecast = forecastDemand(cropHistorical);
            
            // Connect the forecast line to the historical line
            const lastHistorical = cropHistorical[cropHistorical.length - 1];
            const connectionPoint = {
                ...lastHistorical,
                forecastVolume: lastHistorical.historicalVolume // Adding forecastVolume to the last history point for a continuous line
            };
            
            const mergedData = [...cropHistorical, connectionPoint, ...forecast];
            setChartData(mergedData);
            
            // Generate Insight based on linear regression results
            const lastForecast = forecast[forecast.length - 1];
            const trend = lastForecast.forecastVolume > lastHistorical.historicalVolume ? "rise" : "fall";
            const percentChange = Math.abs(((lastForecast.forecastVolume - lastHistorical.historicalVolume) / lastHistorical.historicalVolume) * 100).toFixed(1);
            
            setInsight(`Demand for ${selectedCrop} is expected to ${trend} by ${percentChange}% over the next 6 months based on historical market trends and seasonal analysis.`);
            
            setIsLoading(false);
        }, 1000);
        
        return () => clearTimeout(timer);
    }, [selectedCrop]);

    return (
        <Container className="my-5">
            <h2 className="text-success mb-4 text-center fw-bold">
                <i className="fa-solid fa-chart-line me-2"></i>AI-Powered Demand Forecast
            </h2>
            <p className="text-muted text-center mb-5">Prototype mode analyzing historical sales and simulated market data to project future demand.</p>
            
            <Row className="justify-content-center">
                <Col lg={10}>
                    <Card className="shadow-lg border-0 mb-4 rounded-4" style={{ overflow: 'hidden' }}>
                        <Card.Header className="bg-success text-white p-3 border-0 d-flex justify-content-between align-items-center">
                            <h5 className="mb-0 fw-semibold">Market Projections (6 Months)</h5>
                            <Form.Select 
                                value={selectedCrop} 
                                onChange={e => setSelectedCrop(e.target.value)}
                                style={{ width: '150px' }}
                                size="sm"
                                disabled={isLoading}
                                className="shadow-sm"
                            >
                                <option value="Wheat">Wheat</option>
                                <option value="Rice">Rice</option>
                                <option value="Tomato">Tomato</option>
                            </Form.Select>
                        </Card.Header>
                        
                        <Card.Body className="p-4 bg-light">
                            {isLoading ? (
                                <div className="d-flex flex-column justify-content-center align-items-center py-5 my-5" style={{ height: '400px' }}>
                                    <Spinner animation="border" variant="success" style={{ width: '3rem', height: '3rem' }} />
                                    <h5 className="mt-3 text-success fw-bold">AI is analyzing {selectedCrop} market trends...</h5>
                                    <p className="text-muted small">Running Linear Regression on historical data footprint.</p>
                                </div>
                            ) : (
                                <>
                                    <Alert variant="success" className="d-flex align-items-center mb-4 rounded-3 border-success shadow-sm">
                                        <i className="fa-solid fa-robot fs-3 me-3"></i>
                                        <div>
                                            <h6 className="fw-bold mb-1">AI Insight</h6>
                                            <p className="mb-0 small">{insight}</p>
                                        </div>
                                    </Alert>
                                    
                                    <div style={{ width: '100%', height: '400px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart
                                                data={chartData}
                                                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
                                                <XAxis dataKey="monthLabel" tick={{fontSize: 12}} />
                                                <YAxis tick={{fontSize: 12}} />
                                                <Tooltip 
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                                    labelStyle={{ fontWeight: 'bold', color: '#198754' }}
                                                />
                                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                                
                                                {/* Historical Solid Line */}
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="historicalVolume" 
                                                    stroke="#198754" 
                                                    strokeWidth={3} 
                                                    name="Historical Demand (kg)" 
                                                    dot={{ r: 3, fill: '#198754' }} 
                                                    activeDot={{ r: 6 }} 
                                                />
                                                
                                                {/* Forecasted Dashed Line */}
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="forecastVolume" 
                                                    stroke="#fd7e14" 
                                                    strokeWidth={3} 
                                                    strokeDasharray="5 5" 
                                                    name="AI Forecast (kg)" 
                                                    dot={{ r: 3, fill: '#fd7e14' }} 
                                                    activeDot={{ r: 6 }} 
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="text-end pt-3 text-muted" style={{ fontSize: '0.75rem' }}>
                                        * Model used: Linear Regression (Simulated via KrishiSetu AI)
                                    </div>
                                </>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default DemandForecast;
