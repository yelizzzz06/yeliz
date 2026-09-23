// ==================== 构建全球城市扁平列表 ====================
let globalCityList = [];

// 添加中国所有城市
for (let province in chinaCities) {
    for (let city in chinaCities[province]) {
        let coords = chinaCities[province][city];
        globalCityList.push({ 
            name: city, 
            country: province, 
            lat: coords[0], 
            lng: coords[1] 
        });
    }
}

// 添加全球其他国家城市
for (let country in worldCities) {
    for (let city in worldCities[country]) {
        let coords = worldCities[country][city];
        globalCityList.push({ 
            name: city, 
            country: country, 
            lat: coords[0], 
            lng: coords[1] 
        });
    }
}

console.log(`全球城市数据库加载完成，共 ${globalCityList.length} 个城市`);

// ==================== 核心工具函数 ====================

// Haversine公式计算球面距离（单位：公里）
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 全球最近城市查找
function findNearestCityGlobal(lat, lng) {
    let nearest = null;
    let minDist = Infinity;
    
    for (let city of globalCityList) {
        let dist = haversineDistance(lat, lng, city.lat, city.lng);
        if (dist < minDist) {
            minDist = dist;
            nearest = city;
        }
    }
    return { city: nearest, distance: minDist };
}

// 海洋区域识别
function identifyOcean(lat, lng) {
    if (lat > -60 && lat < 60) {
        if (lng > -180 && lng < -60) return "东太平洋";
        if (lng > -60 && lng < 20) return "大西洋";
        if (lng > 20 && lng < 120) return "印度洋";
        if (lng > 120 && lng < 180) return "西太平洋";
    }
    if (lat >= 60) return "北冰洋";
    if (lat <= -60) return "南大洋";
    
    // 特定海域识别
    if (lat > -10 && lat < 25 && lng > 90 && lng < 140) return "南海/东南亚海域";
    if (lat > 10 && lat < 30 && lng > -100 && lng < -80) return "墨西哥湾";
    if (lat > 30 && lat < 45 && lng > -10 && lng < 5) return "地中海";
    if (lat > 55 && lat < 70 && lng > -20 && lng < 40) return "北海/挪威海";
    
    return "公海";
}

// 获取对跖点位置描述
function getAntipodeDescription(lat, lng) {
    const nearest = findNearestCityGlobal(lat, lng);
    
    if (nearest.distance < 100) {
        return `${nearest.city.country} · ${nearest.city.name}`;
    } else if (nearest.distance < 300) {
        return `${nearest.city.country} · ${nearest.city.name} (约${Math.round(nearest.distance)}km)`;
    } else {
        const ocean = identifyOcean(lat, lng);
        return `${ocean} · 无人区`;
    }
}

// 对跖点核心算法
function calculateAntipode(lat, lng) {
    let antipodeLat = -lat;
    let antipodeLng = (lng + 180) % 360;
    if (antipodeLng > 180) antipodeLng -= 360;
    if (antipodeLng <= -180) antipodeLng += 360;
    return { lat: antipodeLat, lng: antipodeLng };
}

// 坐标格式化显示
function formatCoord(lat, lng) {
    return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
}

// ==================== 地图初始化 ====================
let map = L.map('map').setView([20, 0], 2);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> & CartoDB',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

let originMarker = null;
let antipodeMarker = null;
let polyline = null;

// 更新地图标记和连线
function updateMap(originLat, originLng, antiLat, antiLng) {
    if (originMarker) map.removeLayer(originMarker);
    if (antipodeMarker) map.removeLayer(antipodeMarker);
    if (polyline) map.removeLayer(polyline);
    
    originMarker = L.marker([originLat, originLng]).addTo(map)
        .bindPopup(`<b>📍 原点</b><br>${formatCoord(originLat, originLng)}`);
    antipodeMarker = L.marker([antiLat, antiLng]).addTo(map)
        .bindPopup(`<b>🌐 对跖点</b><br>${formatCoord(antiLat, antiLng)}`);
    polyline = L.polyline([[originLat, originLng], [antiLat, antiLng]], { 
        color: '#ff9800', 
        dashArray: '5, 10' 
    }).addTo(map);
    map.fitBounds([originMarker.getLatLng(), antipodeMarker.getLatLng()]);
}

// 清除地图标记
function clearMapMarkers() {
    if (originMarker) map.removeLayer(originMarker);
    if (antipodeMarker) map.removeLayer(antipodeMarker);
    if (polyline) map.removeLayer(polyline);
    originMarker = null;
    antipodeMarker = null;
    polyline = null;
}

// ==================== 历史记录功能 ====================
let history = JSON.parse(localStorage.getItem('antipodeHistory')) || [];

// 保存查询记录
function saveToHistory(originName, originLat, originLng, antipodePlace, antiLat, antiLng, nearestCityInfo, distance) {
    history.unshift({
        originName: originName,
        originLat: originLat,
        originLng: originLng,
        antipodePlace: antipodePlace,
        antiLat: antiLat,
        antiLng: antiLng,
        nearestCityInfo: nearestCityInfo,
        distance: distance,
        time: new Date().toLocaleString()
    });
    if (history.length > 10) history.pop();
    localStorage.setItem('antipodeHistory', JSON.stringify(history));
    renderHistory();
}

// 渲染历史记录列表
function renderHistory() {
    const historyDiv = document.getElementById('historyList');
    if (!history.length) {
        historyDiv.innerHTML = '<div style="color:#aaa; text-align:center; padding:20px;">暂无记录</div>';
        return;
    }
    historyDiv.innerHTML = history.map((item, idx) => `
        <div class="history-item" data-idx="${idx}">
            <span>📍 ${item.originName} → 🌐 ${item.antipodePlace}</span>
            <span style="font-size:12px; color:#888;">${item.time}</span>
        </div>
    `).join('');
    
    document.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', () => {
            const rec = history[parseInt(el.dataset.idx)];
            document.getElementById('latInput').value = rec.originLat;
            document.getElementById('lngInput').value = rec.originLng;
            calculateAndDisplay();
        });
    });
}

// ==================== 主要计算函数 ====================
let currentSelectedCityName = "";

async function calculateAndDisplay() {
    let lat = parseFloat(document.getElementById('latInput').value);
    let lng = parseFloat(document.getElementById('lngInput').value);
    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        alert("请输入有效的经纬度（纬度-90~90，经度-180~180）");
        return;
    }
    
    const antipode = calculateAntipode(lat, lng);
    const antipodePlace = getAntipodeDescription(antipode.lat, antipode.lng);
    const nearest = findNearestCityGlobal(antipode.lat, antipode.lng);
    
    let nearestCityText = "";
    let distanceText = "";
    if (nearest.city) {
        nearestCityText = `${nearest.city.country} · ${nearest.city.name}`;
        distanceText = `距离约 ${Math.round(nearest.distance)} km`;
    } else {
        nearestCityText = "无匹配城市（位于海洋或无人区）";
        distanceText = identifyOcean(antipode.lat, antipode.lng);
    }
    
    let originDisplayName = currentSelectedCityName;
    if (!originDisplayName || originDisplayName === "") {
        originDisplayName = `自定义坐标 (${formatCoord(lat, lng)})`;
    }
    
    document.getElementById('originPlace').innerHTML = originDisplayName;
    document.getElementById('originCoordLabel').innerHTML = formatCoord(lat, lng);
    document.getElementById('antipodePlace').innerHTML = antipodePlace;
    document.getElementById('antipodeCoordLabel').innerHTML = formatCoord(antipode.lat, antipode.lng);
    document.getElementById('nearestCity').innerHTML = nearestCityText;
    document.getElementById('distanceInfo').innerHTML = distanceText;
    document.getElementById('resultCard').style.display = 'block';
    
    const note = document.getElementById('antipodeNote');
    if (antipodePlace.includes('无人区')) {
        note.innerHTML = '🌊 该点位于海洋区域，以上为最近城市参考';
    } else {
        note.innerHTML = '';
    }
    
    updateMap(lat, lng, antipode.lat, antipode.lng);
    saveToHistory(originDisplayName, lat, lng, antipodePlace, antipode.lat, antipode.lng, nearestCityText, Math.round(nearest.distance));
}

// 互换原点和目标点
async function swapPoints() {
    let lat = parseFloat(document.getElementById('latInput').value);
    let lng = parseFloat(document.getElementById('lngInput').value);
    if (isNaN(lat) || isNaN(lng)) return;
    const antipode = calculateAntipode(lat, lng);
    document.getElementById('latInput').value = antipode.lat.toFixed(6);
    document.getElementById('lngInput').value = antipode.lng.toFixed(6);
    currentSelectedCityName = "";
    await calculateAndDisplay();
}

// ==================== 批量计算功能 ====================
document.getElementById('batchCalcBtn').addEventListener('click', function() {
    const file = document.getElementById('batchFile').files[0];
    if (!file) {
        alert("请选择CSV文件");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const content = e.target.result;
        const lines = content.split(/\r?\n/);
        let results = [["原始纬度", "原始经度", "对跖点纬度", "对跖点经度", "对跖点地名", "最近城市", "距离(km)"]];
        
        for (let i = 0; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const parts = lines[i].split(',').map(s => s.trim());
            let lat = parseFloat(parts[0]);
            let lng = parseFloat(parts[1]);
            if (isNaN(lat) || isNaN(lng)) continue;
            
            const antipode = calculateAntipode(lat, lng);
            const antipodeName = getAntipodeDescription(antipode.lat, antipode.lng);
            const nearest = findNearestCityGlobal(antipode.lat, antipode.lng);
            
            results.push([
                lat, lng, antipode.lat, antipode.lng, antipodeName,
                `${nearest.city?.country || "公海"} · ${nearest.city?.name || "无"}`,
                nearest.distance.toFixed(1)
            ]);
            
            document.getElementById('batchStatus').innerText = `处理中: ${i + 1}/${lines.length}`;
            await new Promise(r => setTimeout(r, 50));
        }
        
        let csvContent = results.map(row => row.join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute("download", "antipode_results.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        document.getElementById('batchStatus').innerText = "✅ 批量计算完成，文件已下载";
    };
    reader.readAsText(file, "UTF-8");
});

// 下载示例模板
document.getElementById('downloadTemplateBtn').addEventListener('click', function() {
    const template = "纬度,经度\n39.9042,116.4074\n40.7128,-74.0060\n35.6895,139.6917\n51.5074,-0.1278\n-33.8688,151.2093";
    const blob = new Blob([template], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "antipode_template.csv";
    link.click();
    URL.revokeObjectURL(blob);
});

// ==================== UI联动逻辑 ====================
const regionSelect = document.getElementById('regionSelect');
const firstLevelSelect = document.getElementById('firstLevelSelect');
const secondLevelSelect = document.getElementById('secondLevelSelect');
const firstLevelCol = document.getElementById('firstLevelCol');
const secondLevelCol = document.getElementById('secondLevelCol');
const firstLevelLabel = document.getElementById('firstLevelLabel');
const secondLevelLabel = document.getElementById('secondLevelLabel');

// 地区选择变化
regionSelect.addEventListener('change', function() {
    const region = this.value;
    firstLevelSelect.innerHTML = '<option value="">-- 请选择 --</option>';
    secondLevelSelect.innerHTML = '<option value="">-- 请先选择 --</option>';
    secondLevelSelect.disabled = true;
    
    if (region === 'china') {
        firstLevelLabel.innerText = '🏞️ 省份';
        secondLevelLabel.innerText = '🏙️ 地级市';
        const provinces = Object.keys(chinaCities).sort();
        for (let province of provinces) {
            let option = document.createElement('option');
            option.value = province;
            option.textContent = province;
            firstLevelSelect.appendChild(option);
        }
        firstLevelSelect.disabled = false;
        firstLevelCol.style.display = 'block';
        secondLevelCol.style.display = 'block';
    } else if (region === 'world') {
        firstLevelLabel.innerText = '🌏 国家';
        secondLevelLabel.innerText = '🏙️ 城市';
        const countries = Object.keys(worldCities).sort();
        for (let country of countries) {
            let option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            firstLevelSelect.appendChild(option);
        }
        firstLevelSelect.disabled = false;
        firstLevelCol.style.display = 'block';
        secondLevelCol.style.display = 'block';
    } else {
        firstLevelCol.style.display = 'none';
        secondLevelCol.style.display = 'none';
        firstLevelSelect.disabled = true;
    }
});

// 第一级选择变化（省份/国家）
firstLevelSelect.addEventListener('change', function() {
    const region = regionSelect.value;
    const selected = this.value;
    secondLevelSelect.innerHTML = '<option value="">-- 请选择 --</option>';
    
    if (region === 'china' && selected && chinaCities[selected]) {
        const cities = chinaCities[selected];
        const sortedCities = Object.keys(cities).sort();
        for (let city of sortedCities) {
            let option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            secondLevelSelect.appendChild(option);
        }
        secondLevelSelect.disabled = false;
    } else if (region === 'world' && selected && worldCities[selected]) {
        const cities = worldCities[selected];
        const sortedCities = Object.keys(cities).sort();
        for (let city of sortedCities) {
            let option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            secondLevelSelect.appendChild(option);
        }
        secondLevelSelect.disabled = false;
    }
});

// 第二级选择变化（城市）
secondLevelSelect.addEventListener('change', function() {
    const region = regionSelect.value;
    const firstLevel = firstLevelSelect.value;
    const secondLevel = this.value;
    let coords = null;
    
    if (region === 'china' && firstLevel && secondLevel && chinaCities[firstLevel] && chinaCities[firstLevel][secondLevel]) {
        coords = chinaCities[firstLevel][secondLevel];
        currentSelectedCityName = `${firstLevel} · ${secondLevel}`;
    } else if (region === 'world' && firstLevel && secondLevel && worldCities[firstLevel] && worldCities[firstLevel][secondLevel]) {
        coords = worldCities[firstLevel][secondLevel];
        currentSelectedCityName = `${firstLevel} · ${secondLevel}`;
    }
    
    if (coords) {
        document.getElementById('latInput').value = coords[0];
        document.getElementById('lngInput').value = coords[1];
        calculateAndDisplay();
    }
});

// ==================== 按钮事件绑定 ====================
document.getElementById('calcBtn').addEventListener('click', calculateAndDisplay);
document.getElementById('swapBtn').addEventListener('click', swapPoints);
document.getElementById('clearMapBtn').addEventListener('click', clearMapMarkers);
document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    history = [];
    localStorage.setItem('antipodeHistory', JSON.stringify(history));
    renderHistory();
});

// ==================== 页面初始化 ====================
renderHistory();

// 默认加载北京市
setTimeout(() => {
    regionSelect.value = 'china';
    regionSelect.dispatchEvent(new Event('change'));
    setTimeout(() => {
        firstLevelSelect.value = '北京市';
        firstLevelSelect.dispatchEvent(new Event('change'));
        setTimeout(() => {
            secondLevelSelect.value = '北京市';
            secondLevelSelect.dispatchEvent(new Event('change'));
        }, 50);
    }, 50);
}, 500);