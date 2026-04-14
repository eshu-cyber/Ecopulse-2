document.addEventListener('DOMContentLoaded', () => {
    // UI Profile Dropdown Logic
    const profileBtn = document.getElementById('profileBtn');
    const profileMenu = document.getElementById('profileMenu');

    if (profileBtn && profileMenu) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profileMenu.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!profileBtn.contains(e.target)) {
                profileMenu.classList.remove('show');
            }
        });
    }

    // Logout logic
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            alert('Logging out...');
        });
    }

    // --- DASHBOARD DATA INTEGRATION ---
    const API_URL = '/api/dashboard-data';
    let fullDashboardData = [];
    
    // Global Dashboard State
    let dashboardState = {
        selectedPollutant: localStorage.getItem('selectedPollutant') || 'AQI',
        selectedYear: localStorage.getItem('selectedYear') || 'all',
        selectedMonth: localStorage.getItem('selectedMonth') || 'all',
        selectedDate: localStorage.getItem('selectedDate') || '2025-05-15'
    };

    const saveState = () => {
        Object.keys(dashboardState).forEach(key => {
            localStorage.setItem(key, dashboardState[key]);
        });
    };

    const getAQICategory = (aqi) => {
        if (aqi <= 50) return { label: 'Good', color: 'bg-primary' };
        if (aqi <= 100) return { label: 'Moderate', color: 'bg-secondary' };
        if (aqi <= 150) return { label: 'Sensitive', color: 'bg-yellow-500' };
        if (aqi <= 200) return { label: 'Unhealthy', color: 'bg-error' };
        if (aqi <= 300) return { label: 'Very Unhealthy', color: 'bg-purple-500' };
        return { label: 'Hazardous', color: 'bg-red-900' };
    };

    const updateStats = (data, dateFromPicker = null) => {
        if (!data || data.length === 0) return;
        
        const selectedDate = dateFromPicker || dashboardState.selectedDate;
        
        // Find specific date point or fallback to latest
        let targetPoint = data.find(d => d.Date === selectedDate);
        
        // Fallback to latest if no match
        const latest = targetPoint || data[data.length - 1];
        const category = getAQICategory(latest.AQI);
        
        console.log('Updating stats with point:', latest.Date, latest.Type);

        // Update Overview Stats
        if (document.getElementById('stat-aqi')) {
            document.getElementById('stat-aqi').textContent = Math.round(latest.AQI);
            const catEl = document.getElementById('stat-aqi-category');
            if (catEl) {
                catEl.textContent = category.label;
                catEl.className = `px-2 py-0.5 rounded text-[10px] font-bold ${category.color} text-white uppercase`;
            }
            
            const pollutants = { 'PM2.5': latest.PM2_5, 'PM10': latest.PM10, 'NO2': latest.NO2, 'SO2': latest.SO2 };
            const maxPollutant = Object.entries(pollutants).reduce((a, b) => (b[1] && a[1] < b[1]) ? b : a);
            const pollEl = document.getElementById('stat-pollutant');
            if (pollEl) pollEl.textContent = maxPollutant[0];
            
            const pm10El = document.getElementById('stat-pm10');
            if (pm10El) pm10El.textContent = Math.round(latest.PM10);
            
            const historical = data.filter(d => d.Type === 'Historical');
            const trendEl = document.getElementById('stat-trend');
            if (trendEl && historical.length > 365) {
                const currentAvg = latest.AQI;
                const prevYearAvg = historical[historical.length - 366].AQI;
                const diff = ((currentAvg - prevYearAvg) / prevYearAvg * 100).toFixed(1);
                trendEl.textContent = (diff > 0 ? '+' : '') + diff + '%';
            }
        }

        // Update Air Quality Page Stats
        if (document.getElementById('aqi-val')) {
            document.getElementById('aqi-val').textContent = Math.round(latest.AQI);
            const statusEl = document.getElementById('aqi-status');
            if (statusEl) statusEl.textContent = category.label;
            const progEl = document.getElementById('aqi-progress');
            if (progEl) progEl.style.width = `${Math.min(100, (latest.AQI/300)*100)}%`;
            
            const pm25Val = document.getElementById('pm25-val');
            if (pm25Val) {
                pm25Val.textContent = Math.round(latest.PM2_5);
                const pm25Status = document.getElementById('pm25-status');
                if (pm25Status) pm25Status.textContent = latest.PM2_5 > 60 ? 'HIGH' : 'SAFE';
                const pm25Prog = document.getElementById('pm25-progress');
                if (pm25Prog) pm25Prog.style.width = `${Math.min(100, (latest.PM2_5/150)*100)}%`;
            }

            const pm10Val = document.getElementById('pm10-val');
            if (pm10Val) {
                pm10Val.textContent = Math.round(latest.PM10);
                const pm10Status = document.getElementById('pm10-status');
                if (pm10Status) pm10Status.textContent = latest.PM10 > 100 ? 'MODERATE' : 'GOOD';
                const pm10Prog = document.getElementById('pm10-progress');
                if (pm10Prog) pm10Prog.style.width = `${Math.min(100, (latest.PM10/250)*100)}%`;
            }

            const coVal = document.getElementById('co-val');
            if (coVal) {
                coVal.textContent = latest.CO.toFixed(2);
                const coStatus = document.getElementById('co-status');
                if (coStatus) coStatus.textContent = latest.CO > 2.0 ? 'WATCH' : 'EXCELLENT';
                const coProg = document.getElementById('co-progress');
                if (coProg) coProg.style.width = `${Math.min(100, (latest.CO/5)*100)}%`;
            }

            const so2Val = document.getElementById('so2-val');
            if (so2Val) {
                so2Val.textContent = Math.round(latest.SO2);
                const so2Status = document.getElementById('so2-status');
                if (so2Status) so2Status.textContent = latest.SO2 > 20 ? 'ELEVATED' : 'SAFE';
                const so2Prog = document.getElementById('so2-progress');
                if (so2Prog) so2Prog.style.width = `${Math.min(100, (latest.SO2/80)*100)}%`;
            }

            // Trigger Analysis update
            updatePollutantAnalysis(latest);
            

        }
    };



    const updatePollutantAnalysis = (point) => {
        const titleEl = document.getElementById('insight-title');
        const descEl = document.getElementById('insight-description');
        const sourceEl = document.getElementById('insight-source');
        const healthEl = document.getElementById('insight-health');

        if (!titleEl) return;

        const aqi = Math.round(point.AQI);
        const cat = getAQICategory(aqi);

        // Determine primary pollutant
        const pollutants = [
            { id: 'PM2.5', val: point.PM2_5, threshold: 60, source: 'Industrial smoke and combustion' },
            { id: 'PM10', val: point.PM10, threshold: 100, source: 'Construction dust and road suspension' },
            { id: 'NO2', val: point.NO2, threshold: 80, source: 'Vehicular emissions and heavy traffic' },
            { id: 'SO2', val: point.SO2, threshold: 20, source: 'Boilers and industrial coal burning' },
            { id: 'CO', val: point.CO, threshold: 2.0, source: 'Incomplete combustion and machinery' }
        ];

        // Find pollutant with highest relative impact (val/threshold)
        const primary = pollutants.reduce((prev, curr) => (curr.val / curr.threshold > prev.val / prev.threshold) ? curr : prev);
        const status = primary.val > primary.threshold ? 'High' : (primary.val > primary.threshold * 0.5 ? 'Moderate' : 'Low');

        titleEl.textContent = `${cat.label} Air Quality | Primary: ${primary.id}`;
        titleEl.className = `text-lg font-bold italic ${cat.color.replace('bg-', 'text-')}`;

        descEl.textContent = `On this date, the AQI is primarily driven by ${primary.id} levels (${primary.val.toFixed(1)} µg/m³), which are considered ${status.toLowerCase()}.`;
        
        sourceEl.textContent = `The elevated ${primary.id} suggests a significant contribution from ${primary.source.toLowerCase()} in the ECOPULSE monitoring zone.`;
        
        const healthAdvice = {
            'Good': 'Air quality is satisfactory. No health risk for the general population.',
            'Moderate': 'Sensitive groups should consider limiting prolonged outdoor exertion.',
            'Sensitive': 'Increased likelihood of respiratory symptoms in sensitive individuals.',
            'Unhealthy': 'Everyone may begin to experience health effects; sensitive groups more so.',
            'Very Unhealthy': 'Health alert: everyone may experience more serious health effects.',
            'Hazardous': 'Emergency conditions: the entire population is more likely to be affected.'
        };
        healthEl.textContent = healthAdvice[cat.label] || 'Monitor local advisories.';
    };

    const updateSourcesPage = () => {
        const temporalContainer = document.getElementById('sources-temporal-container');
        const healthCardsContainer = document.getElementById('sources-health-cards');
        const titleEl = document.getElementById('source-chart-title');

        if (!temporalContainer && !healthCardsContainer) return;

        const p = dashboardState.selectedPollutant;
        const profile = sourcePollutantProfiles[p] || sourcePollutantProfiles['AQI'];

        if (titleEl) titleEl.textContent = `Emission Source Contributions (${p})`;

        // Render Temporal Bars
        if (temporalContainer) {
            temporalContainer.innerHTML = '';
            const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
            days.forEach((day, i) => {
                const barGroup = document.createElement('div');
                barGroup.className = 'flex-1 flex flex-col justify-end gap-1 group/bar h-full';
                
                // Add staggered delays for animation
                const baseHeight = 40 + (Math.random() * 20); // Random base variation
                
                const sectors = [
                    { key: 'primary', color: 'bg-primary', label: 'Industrial' },
                    { key: 'secondary', color: 'bg-secondary', label: 'Power/Power Cluster' },
                    { key: 'tertiary', color: 'bg-tertiary', label: 'Vehicle/Construction' }
                ];

                sectors.forEach((sector, sIdx) => {
                    const contribution = profile.contributions[sector.key];
                    const segment = document.createElement('div');
                    const height = (contribution / 100) * baseHeight * (1 + (Math.sin(i + sIdx) * 0.2));
                    segment.className = `${sector.color} opacity-80 group-hover/bar:opacity-100 transition-all rounded-sm`;
                    segment.style.height = `${height}%`;
                    barGroup.appendChild(segment);
                });

                const label = document.createElement('span');
                label.className = 'text-[10px] text-center mt-3 text-on-surface-variant font-bold';
                label.textContent = day;
                barGroup.appendChild(label);
                temporalContainer.appendChild(barGroup);
            });
        }

        // Render Health Cards
        if (healthCardsContainer) {
            healthCardsContainer.innerHTML = '';
            profile.healthCards.forEach(card => {
                const cardEl = document.createElement('div');
                cardEl.className = 'bg-surface-container rounded-full p-6 glass-panel hover:bg-surface-container-high transition-all border border-outline-variant/5';
                cardEl.innerHTML = `
                    <div class="w-12 h-12 ${card.iconBg} rounded-xl flex items-center justify-center mb-4">
                        <span class="material-symbols-outlined ${card.iconColor}">${card.icon}</span>
                    </div>
                    <h4 class="text-lg font-semibold text-on-surface">${card.title}</h4>
                        <p class="text-[10px] text-on-surface-variant font-medium truncate">admin@ecopulse.io</p>
                    <div class="mt-4 pt-4 border-t border-outline-variant/10 flex justify-between items-center">
                        <span class="text-[10px] font-bold ${card.riskColor} uppercase">${card.risk}</span>
                        <span class="material-symbols-outlined text-on-surface-variant text-sm" data-icon="arrow_forward">arrow_forward</span>
                    </div>
                `;
                healthCardsContainer.appendChild(cardEl);
            });
        }
    };

    const sourcePollutantProfiles = {
        'AQI': {
            contributions: { primary: 40, secondary: 30, tertiary: 30 },
            healthCards: [
                { title: 'General Respiratory Impact', desc: 'Overall air quality affects lung capacity and can trigger asthma.', risk: 'Cumulative Risk', icon: 'respiratory_rate', iconBg: 'bg-error-container/30', iconColor: 'text-error', riskColor: 'text-error' },
                { title: 'Cardiovascular Health', desc: 'Prolonged exposure to varied pollutants increases heart strain.', risk: 'Moderate Stress', icon: 'favorite', iconBg: 'bg-primary-container/30', iconColor: 'text-primary', riskColor: 'text-primary' }
            ]
        },
        'PM2_5': {
            contributions: { primary: 70, secondary: 20, tertiary: 10 },
            healthCards: [
                { title: 'Lung Deep Penetration', desc: 'Fine particles enter the bloodstream and gas-exchange regions.', risk: 'Critical Priority', icon: 'lungs', iconBg: 'bg-error-container/30', iconColor: 'text-error', riskColor: 'text-error' },
                { title: 'Industrial Smog', desc: 'Combustion byproducts from local factories create hazy conditions.', risk: 'Primary Driver', icon: 'factory', iconBg: 'bg-secondary-container/30', iconColor: 'text-secondary', riskColor: 'text-secondary' }
            ]
        },
        'PM10': {
            contributions: { primary: 20, secondary: 30, tertiary: 50 },
            healthCards: [
                { title: 'Upper Airway Irritation', desc: 'Coarse dust particles cause coughing and throat irritation.', risk: 'Moderate Focus', icon: 'airway', iconBg: 'bg-tertiary-container/30', iconColor: 'text-tertiary', riskColor: 'text-tertiary' },
                { title: 'Construction Dust', desc: 'Infrastructural development contributes to suspended particulates.', risk: 'Major Source', icon: 'construction', iconBg: 'bg-surface-container-high/30', iconColor: 'text-on-surface', riskColor: 'text-on-surface' }
            ]
        },
        'NO2': {
            contributions: { primary: 10, secondary: 30, tertiary: 60 },
            healthCards: [
                { title: 'Traffic Emissions', desc: 'Vehicle exhaust is the primary driver for high nitrogen levels.', risk: 'High Concern', icon: 'directions_car', iconBg: 'bg-error-container/30', iconColor: 'text-error', riskColor: 'text-error' },
                { title: 'Respiratory Inflammation', desc: 'NO2 leads to significant inflammation of the airways.', risk: 'Medical Alert', icon: 'pulmonology', iconBg: 'bg-primary-container/30', iconColor: 'text-primary', riskColor: 'text-primary' }
            ]
        },
        'SO2': {
            contributions: { primary: 80, secondary: 10, tertiary: 10 },
            healthCards: [
                { title: 'Boiler Emissions', desc: 'Coal-fired power and industrial boilers release sulfur compounds.', risk: 'Industry Priority', icon: 'precision_manufacturing', iconBg: 'bg-error-container/30', iconColor: 'text-error', riskColor: 'text-error' },
                { title: 'Acid Rain Precursors', desc: 'SO2 reacts with air to form acidic secondary pollutants.', risk: 'Environmental Risk', icon: 'cloud_download', iconBg: 'bg-secondary-container/30', iconColor: 'text-secondary', riskColor: 'text-secondary' }
            ]
        },
        'CO': {
            contributions: { primary: 40, secondary: 50, tertiary: 10 },
            healthCards: [
                { title: 'Oxygen Transport', desc: 'Carbon Monoxide reduces the capacity of blood to carry oxygen.', risk: 'Critical Warning', icon: 'bloodtype', iconBg: 'bg-error-container/30', iconColor: 'text-error', riskColor: 'text-error' },
                { title: 'Heavy Machinery', desc: 'Inefficient engines in industrial units contribute to CO spikes.', risk: 'Machine Control', icon: 'settings_slow_motion', iconBg: 'bg-surface-container-high/30', iconColor: 'text-on-surface', riskColor: 'text-on-surface' }
            ]
        }
    };

    const renderTrendChart = (data) => {
        const container = document.getElementById('chart-container');
        const labelsContainer = document.getElementById('chart-x-labels');
        if (!container) return;

        container.innerHTML = '';
        if (labelsContainer) labelsContainer.innerHTML = '';

        // Filter data based on Month/Year Range
        let filteredData = [...data];
        if (dashboardState.selectedYear !== 'all') {
            filteredData = filteredData.filter(d => d.Year.toString() === dashboardState.selectedYear);
        }
        if (dashboardState.selectedMonth !== 'all') {
            filteredData = filteredData.filter(d => d.Month.toString() === dashboardState.selectedMonth);
        }

        const pollutantKey = dashboardState.selectedPollutant === 'PM2_5' ? 'PM2_5' : dashboardState.selectedPollutant;
        
        // Downsample for performance if needed
        const maxBars = 80;
        const step = Math.max(1, Math.floor(filteredData.length / maxBars));
        const plotData = filteredData.filter((_, i) => i % step === 0);

        const maxVal = Math.max(...plotData.map(d => d[pollutantKey]), 1);

        plotData.forEach((point, idx) => {
            const bar = document.createElement('div');
            const val = point[pollutantKey];
            const heightPerc = (val / maxVal) * 100;
            
            // Scaled category color for AQI or general blue/red for pollutants
            let barColor = point.Type === 'Historical' ? 'bg-primary/40' : 'bg-error/40';
            if (dashboardState.selectedPollutant === 'AQI') {
                const cat = getAQICategory(val);
                barColor = point.Type === 'Historical' ? `${cat.color}/40` : 'bg-error/40';
            }

            bar.className = `group relative flex-1 ${barColor} hover:brightness-125 transition-all rounded-t-sm cursor-help`;
            bar.style.height = `${heightPerc}%`;
            
            // Tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-[10px] p-2 rounded-lg border border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none whitespace-nowrap';
            tooltip.innerHTML = `
                <p class="font-bold text-slate-100">${point.Date}</p>
                <p class="text-sky-400">${dashboardState.selectedPollutant}: ${val.toFixed(1)}</p>
                <p class="text-[9px] text-slate-400">${point.Type}</p>
            `;
            bar.appendChild(tooltip);
            container.appendChild(bar);

            // X-Axis labels
            if (labelsContainer && idx % Math.floor(plotData.length / 6) === 0) {
                const label = document.createElement('span');
                label.textContent = point.Date.substring(5, 10); // MM-DD
                labelsContainer.appendChild(label);
            }
        });

        // Update UI components that display current pollutant name
        const periodLabel = document.getElementById('trend-period-label');
        if (periodLabel) {
            const rangeText = dashboardState.selectedMonth !== 'all' ? `Month: ${dashboardState.selectedMonth}` : 'All Months';
            periodLabel.textContent = `${dashboardState.selectedPollutant} Trends (${rangeText}, ${dashboardState.selectedYear})`;
        }
    };

    const fetchDashboardData = async () => {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            fullDashboardData = await response.json();
            
            // Sync UI with State
            syncUIWithState();
            
            updateStats(fullDashboardData);
            renderTrendChart(fullDashboardData);
            updateSourcesPage();
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            const container = document.getElementById('chart-container');
            if (container) container.innerHTML = `<div class="w-full flex items-center justify-center text-error text-sm font-medium">Failed to connect to ML Backend.</div>`;
        }
    };
    
    // --- CSV EXPORT LOGIC ---
    const exportToCSV = () => {
        if (!fullDashboardData || fullDashboardData.length === 0) {
            alert('No data available to export.');
            return;
        }

        const headers = Object.keys(fullDashboardData[0]).join(',');
        const rows = fullDashboardData.map(row => 
            Object.values(row).map(val => 
                typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
            ).join(',')
        );
        
        const csvContent = [headers, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `AQI_Data_Export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const syncUIWithState = () => {
        // Sync Dropdowns
        const mRange = document.getElementById('month-range');
        const yRange = document.getElementById('year-range');
        const dPicker = document.getElementById('date-picker');
        
        if (mRange) mRange.value = dashboardState.selectedMonth;
        if (yRange) yRange.value = dashboardState.selectedYear;
        if (dPicker) dPicker.value = dashboardState.selectedDate;

        // Sync Pollutant Buttons
        const btns = document.querySelectorAll('.pollutant-btn');
        btns.forEach(btn => {
            if (btn.dataset.pollutant === dashboardState.selectedPollutant) {
                btn.classList.add('active', 'bg-sky-400/10', 'text-sky-400');
                btn.classList.remove('bg-slate-800/50', 'text-slate-400');
            } else {
                btn.classList.remove('active', 'bg-sky-400/10', 'text-sky-400');
                btn.classList.add('bg-slate-800/50', 'text-slate-400');
            }
        });
    };

    // --- EVENT LISTENERS ---

    // Range Logic
    const setupListeners = () => {
        const mRange = document.getElementById('month-range');
        const yRange = document.getElementById('year-range');
        const dPicker = document.getElementById('date-picker');

        if (mRange) {
            mRange.addEventListener('change', (e) => {
                dashboardState.selectedMonth = e.target.value;
                saveState();
                renderTrendChart(fullDashboardData);
            });
        }

        if (yRange) {
            yRange.addEventListener('change', (e) => {
                dashboardState.selectedYear = e.target.value;
                saveState();
                renderTrendChart(fullDashboardData);
            });
        }

        if (dPicker) {
            dPicker.addEventListener('change', (e) => {
                dashboardState.selectedDate = e.target.value;
                saveState();
                updateStats(fullDashboardData, e.target.value);
            });
        }

        // Pollutant Button Listeners
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.pollutant-btn');
            if (btn) {
                dashboardState.selectedPollutant = btn.dataset.pollutant;
                saveState();
                syncUIWithState();
                renderTrendChart(fullDashboardData);
                // Also update stats if they are currently displaying something relevant
                updateStats(fullDashboardData);
                updateSourcesPage();
            }
        });

        // Export button listener
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportToCSV);
        }
    };

    // Initialize
    setupListeners();
    if (document.getElementById('chart-container') || 
        document.getElementById('aqi-val') || 
        document.getElementById('stat-aqi') || 
        document.getElementById('sources-temporal-container')) {
        fetchDashboardData();
    }
});
