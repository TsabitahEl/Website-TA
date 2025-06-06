document.addEventListener('DOMContentLoaded', function() {
    // Setup V/C Ratio Chart
    const vcCtx = document.getElementById('vcRatioChart').getContext('2d');
    const vcRatioChart = new Chart(vcCtx, {
        type: 'gauge',
        data: {
            datasets: [{
                value: 0,
                minValue: 0,
                maxValue: 1,
                data: [0.33, 0.66, 1],
                backgroundColor: ['#4CAF50', '#FFC107', '#FF5252']
            }]
        },
        options: {
            needle: {
                radiusPercentage: 2,
                widthPercentage: 3.2,
                lengthPercentage: 80,
                color: 'rgba(0, 0, 0, 1)'
            },
            valueLabel: {
                display: true,
                formatter: (value) => `V/C: ${value.toFixed(2)}`,
                color: '#483AA0',
                backgroundColor: 'rgba(0,0,0,0)',
                fontSize: 16,
                borderRadius: 5,
                padding: {
                    top: 10,
                    bottom: 10
                }
            }
        }
    });

    // Function to update V/C ratio
    window.updateVCRatio = function(vehicleCount) {
        // Assume road capacity is 1000 vehicles
        const roadCapacity = 1000;
        const vcRatio = vehicleCount / roadCapacity;
        vcRatioChart.data.datasets[0].value = vcRatio;
        vcRatioChart.update();
    }
});