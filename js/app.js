// =========================================
// DATA SERVICE (FETCHES JSON FILES)
// =========================================
const DataService = {
    // Fetches the list of dramas first
    async getAllDramas() {
        try {
            const response = await fetch('data/dramas.json');
            if (!response.ok) throw new Error('Network response was not ok');
            const dramaList = await response.json();
            
            // To display the home page properly, we need details (poster, title).
            // We will fetch details for all dramas in the list.
            // In a real massive app, you might optimize this with pagination or a search index.
            const detailedDramas = await Promise.all(
                dramaList.map(async (item) => {
                    const detailRes = await fetch(`data/${item.file}`);
                    return await detailRes.json();
                })
            );
            
            return detailedDramas;
        } catch (error) {
            console.error('Error loading dramas:', error);
            return [];
        }
    },

    async getDramaById(id) {
        try {
            const response = await fetch('data/dramas.json');
            const dramaList = await response.json();
            
            const item = dramaList.find(d => d.id === id);
            if (!item) return null;

            const detailRes = await fetch(`data/${item.file}`);
            return await detailRes.json();
        } catch (error) {
            console.error('Error loading drama details:', error);
            return null;
        }
    }
};

// =========================================
// UTILS
// =========================================
const Utils = {
    qs: (sel) => document.querySelector(sel),
    qsa: (sel) => document.querySelectorAll(sel),
    
    getParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            drama: params.get('drama'),
            season: params.get('season'),
            episode: params.get('episode')
        };
    },

    setParams(params) {
        const url = new URL(window.location);
        if(params.drama) url.searchParams.set('drama', params.drama);
        if(params.season) url.searchParams.set('season', params.season);
        if(params.episode) url.searchParams.set('episode', params.episode);
        window.history.pushState({}, '', url);
    },

    formatTime(seconds) {
        if(!seconds) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    },

    saveToStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },

    getFromStorage(key) {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    }
};

// =========================================
// UI COMPONENTS
// =========================================
const UI = {
    toastTimeout: null,

    showToast(msg) {
        const toast = Utils.qs('#toast');
        const toastMsg = Utils.qs('#toastMsg');
        toastMsg.textContent = msg;
        toast.classList.add('show');
        
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    },

    toggleMenu() {
        Utils.qs('#navLinks').classList.toggle('active');
    },

    createSkeletonCard() {
        return `
            <div class="drama-card">
                <div class="card-poster skeleton"></div>
                <div class="card-info">
                    <div class="skeleton" style="height:20px; width:80%; margin-bottom:10px;"></div>
                    <div class="skeleton" style="height:15px; width:50%;"></div>
                </div>
            </div>
        `;
    },

    createCard(drama) {
        const isFav = Utils.getFromStorage('favorites')?.includes(drama.id);
        return `
            <div class="drama-card" onclick="app.router.navigate('?drama=${drama.id}')">
                <div class="card-poster">
                    <img src="${drama.poster}" loading="lazy" alt="${drama.title}">
                    <span class="card-rating">★ ${drama.rating}</span>
                    <span class="card-status">${drama.status}</span>
                </div>
                <div class="card-info">
                    <div class="card-title">${drama.title}</div>
                    <div class="card-meta">
                        <span>${drama.year}</span>
                        <span>${drama.genres[0]}</span>
                    </div>
                </div>
            </div>
        `;
    },

    toggleFavorite(dramaId) {
        let favs = Utils.getFromStorage('favorites') || [];
        if (favs.includes(dramaId)) {
            favs = favs.filter(id => id !== dramaId);
            this.showToast('Removed from Favorites');
        } else {
            favs.push(dramaId);
            this.showToast('Added to Favorites ❤️');
        }
        Utils.saveToStorage('favorites', favs);
        app.router.refresh();
    },

    async showFavorites() {
        const favIds = Utils.getFromStorage('favorites') || [];
        if(favIds.length === 0) {
            Utils.qs('#app').innerHTML = `<div class="container" style="padding:100px 0; text-align:center;"><h2>No favorites yet</h2></div>`;
            return;
        }
        const allDramas = await DataService.getAllDramas();
        const filtered = allDramas.filter(d => favIds.includes(d.id));
        
        let html = `
            <div class="container fade-in">
                <div class="section-header"><h2 class="section-title">My Favorites</h2></div>
                <div class="card-grid">
                    ${filtered.map(d => this.createCard(d)).join('')}
                </div>
            </div>
        `;
        Utils.qs('#app').innerHTML = html;
        window.scrollTo(0,0);
    },

    async showHistory() {
        const history = Utils.getFromStorage('history') || [];
        if(history.length === 0) {
            Utils.qs('#app').innerHTML = `<div class="container" style="padding:100px 0; text-align:center;"><h2>No watch history</h2></div>`;
            return;
        }
        let html = `
            <div class="container fade-in">
                <div class="section-header"><h2 class="section-title">Recently Watched</h2></div>
                <div class="card-grid">
                    ${history.map(d => this.createCard(d)).join('')}
                </div>
            </div>
        `;
        Utils.qs('#app').innerHTML = html;
        window.scrollTo(0,0);
    }
};

// =========================================
// ROUTER & VIEWS
// =========================================
const Router = {
    async init() {
        window.addEventListener('popstate', () => this.handleRoute());
        
        // Search Listener
        Utils.qs('#searchInput').addEventListener('input', async (e) => {
            const term = e.target.value.toLowerCase();
            if (term.length < 2) return;
            
            const dramas = await DataService.getAllDramas();
            const filtered = dramas.filter(d => 
                d.title.toLowerCase().includes(term) || 
                d.genres.some(g => g.toLowerCase().includes(term))
            );
            
            const grid = Utils.qs('.card-grid');
            if(grid) {
                grid.innerHTML = filtered.length ? filtered.map(d => UI.createCard(d)).join('') : '<p>No results found.</p>';
            }
        });

        this.handleRoute();
    },

    async navigate(url) {
        if(url.startsWith('?')) {
            const newUrl = window.location.pathname + url;
            window.history.pushState({}, '', newUrl);
        } else {
            window.history.pushState({}, '', url);
        }
        this.handleRoute();
    },
    
    refresh() {
        this.handleRoute();
    },

    async handleRoute() {
        const params = Utils.getParams();
        const appDiv = Utils.qs('#app');
        
        Utils.qs('#navLinks').classList.remove('active');

        if (!params.drama) {
            this.renderHome(appDiv);
        } else if (params.drama && !params.episode) {
            this.renderDrama(appDiv, params.drama);
        } else if (params.drama && params.season && params.episode) {
            this.renderPlayer(appDiv, params);
        }
    },

    async renderHome(container) {
        container.innerHTML = `
            <div class="hero-section skeleton"></div>
            <div class="container">
                <div class="section-header"><div class="skeleton" style="width:200px; height:30px;"></div></div>
                <div class="card-grid">${Array(4).fill(UI.createSkeletonCard()).join('')}</div>
            </div>
        `;

        const dramas = await DataService.getAllDramas();
        
        const heroSlide = (d, index) => `
            <div class="hero-slide ${index === 0 ? 'active' : ''}">
                <img src="${d.banner}" class="hero-bg" alt="${d.title}">
                <div class="hero-overlay">
                    <div class="hero-content">
                        <h1 class="hero-title">${d.title}</h1>
                        <div class="hero-meta">
                            <span class="tag">${d.year}</span>
                            <span class="tag">${d.genres[0]}</span>
                            <span class="tag">⭐ ${d.rating}</span>
                        </div>
                        <button class="btn btn-primary" onclick="app.router.navigate('?drama=${d.id}')">
                            Watch Now
                        </button>
                    </div>
                </div>
            </div>
        `;

        const createSection = (title, list) => `
            <div class="container">
                <div class="section-header">
                    <h2 class="section-title">${title}</h2>
                </div>
                <div class="card-grid">
                    ${list.map(d => UI.createCard(d)).join('')}
                </div>
            </div>
            <div class="ad-banner">ADVERTISEMENT SPACE</div>
        `;

        const sliderScript = `
            <script>
                let currentSlide = 0;
                const slides = document.querySelectorAll('.hero-slide');
                if(slides.length > 0) {
                    setInterval(() => {
                        slides[currentSlide].classList.remove('active');
                        currentSlide = (currentSlide + 1) % slides.length;
                        slides[currentSlide].classList.add('active');
                    }, 5000);
                }
            <\/script>
        `;

        const history = Utils.getFromStorage('history') || [];
        const continueWatchingHtml = history.length > 0 ? createSection('Continue Watching', history.slice(0,4)) : '';

        container.innerHTML = `
            <section class="hero-section">
                ${dramas.slice(0, 3).map((d, i) => heroSlide(d, i)).join('')}
            </section>
            ${sliderScript}
            ${continueWatchingHtml}
            ${createSection('Trending Now', dramas)}
            ${createSection('Latest Dramas', dramas.slice().reverse())}
        `;
        
        document.title = "DramaVault - Home";
    },

    async renderDrama(container, id) {
        container.innerHTML = `
            <div class="skeleton" style="height:60vh;"></div>
            <div class="container skeleton" style="height:400px;"></div>
        `;

        const drama = await DataService.getDramaById(id);
        if (!drama) {
            container.innerHTML = '<div class="container" style="padding:50px;">Drama not found.</div>';
            return;
        }

        const isFav = Utils.getFromStorage('favorites')?.includes(drama.id);
        const seasonTabs = drama.seasons.map((s, i) => 
            `<div class="season-tab ${i === 0 ? 'active' : ''}" onclick="app.ui.switchSeason(${s.season})">Season ${s.season}</div>`
        ).join('');

        const episodesHtml = this.generateEpisodesHtml(drama, drama.seasons[0].season);

        container.innerHTML = `
            <div class="fade-in">
                <div class="drama-header">
                    <img src="${drama.banner}" class="drama-banner">
                </div>
                <div class="container">
                    <div class="drama-info-container">
                        <img src="${drama.poster}" class="drama-poster-lg">
                        <div class="drama-details">
                            <h1 class="drama-title-lg">${drama.title}</h1>
                            <div class="stats-row">
                                <div class="stat-item"><span class="stat-value">${drama.year}</span> Year</div>
                                <div class="stat-item"><span class="stat-value">${drama.rating}</span> Rating</div>
                                <div class="stat-item"><span class="stat-value">${drama.views}</span> Views</div>
                                <div class="stat-item"><span class="stat-value">${drama.status}</span></div>
                            </div>
                            <div class="drama-desc">${drama.description}</div>
                            <div style="display:flex; gap:15px; justify-content:center;">
                                <button class="btn btn-primary" onclick="app.router.navigate('?drama=${drama.id}&season=1&episode=1')">
                                    ▶ Watch S1 E1
                                </button>
                                <button class="btn" style="border:1px solid #ddd; background:white;" onclick="app.ui.toggleFavorite('${drama.id}')">
                                    ${isFav ? '❤️ Favorited' : '🤍 Add Favorite'}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="ad-banner">ADVERTISEMENT BANNER</div>
                    <h2 style="margin-bottom:20px;">Episodes</h2>
                    <div class="season-tabs" id="seasonTabs">
                        ${seasonTabs}
                    </div>
                    <div id="episodeList" class="episode-grid">
                        ${episodesHtml}
                    </div>
                    <div style="margin-bottom: 50px;"></div>
                </div>
            </div>
        `;
        document.title = `${drama.title} - DramaVault`;
        window.scrollTo(0, 0);
    },

    generateEpisodesHtml(drama, seasonNum) {
        const season = drama.seasons.find(s => s.season == seasonNum);
        if (!season) return '';
        
        return season.episodes.map(ep => `
            <div class="episode-card" onclick="app.router.navigate('?drama=${drama.id}&season=${season.season}&episode=${ep.episode}')">
                <img src="${ep.thumbnail}" class="ep-thumb">
                <div class="ep-info">
                    <div class="ep-num">EP ${ep.episode}</div>
                    <div class="ep-title">${ep.title}</div>
                </div>
            </div>
        `).join('');
    },

    renderPlayer(container, params) {
        const accessKey = `access_${params.drama}_${params.season}_${params.episode}`;
        const hasAccess = Utils.getFromStorage(accessKey);
        
        container.innerHTML = `
            <div class="container fade-in" style="padding-top:20px;">
                <div style="margin-bottom:10px;">
                    <a href="#" onclick="app.router.navigate('?drama=${params.drama}')" style="color:var(--text-light); font-size:0.9rem;">
                        ← Back to Details
                    </a>
                </div>
                <h2 id="playerTitle" style="margin-bottom:15px;">Loading...</h2>

                <div class="player-wrapper" id="playerWrapper">
                    ${hasAccess 
                        ? `<video id="videoPlayer" class="video-player" controls playsinline>
                             <source src="" type="video/mp4">
                           </video>
                           <div class="controls-overlay">
                               <div class="progress-bar-container" id="progressBar">
                                   <div class="progress-bar-fill" id="progressFill"></div>
                               </div>
                               <div class="controls-row">
                                   <div>
                                       <button class="control-btn" onclick="app.player.togglePlay()">▶</button>
                                       <button class="control-btn" onclick="app.player.toggleMute()">🔊</button>
                                       <span id="timeDisplay" style="font-size:0.8rem;">0:00</span>
                                   </div>
                                   <div>
                                       <button class="control-btn" onclick="app.player.toggleFullscreen()">⛶</button>
                                   </div>
                               </div>
                           </div>`
                        : `<div class="access-screen">
                             <div class="big-play-btn" onclick="app.player.handleAccessClick('${accessKey}')">
                                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                             </div>
                             <div class="access-msg">Continue To Watch</div>
                             <div class="access-sub">Sponsored content will open in a new tab</div>
                           </div>`
                    }
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <button class="btn" style="background:#eee;" id="prevBtn">← Previous</button>
                    <button class="btn btn-primary" id="nextBtn">Next →</button>
                </div>
            </div>
        `;

        if (hasAccess) {
            this.initPlayerLogic(params);
        } else {
            this.setupNavButtons(params);
        }
    },

    setupNavButtons(params) {
        const nextBtn = Utils.qs('#nextBtn');
        if(nextBtn) {
            nextBtn.onclick = () => {
                const nextEp = parseInt(params.episode) + 1;
                app.router.navigate(`?drama=${params.drama}&season=${params.season}&episode=${nextEp}`);
            };
        }
    },

    async initPlayerLogic(params) {
        const drama = await DataService.getDramaById(params.drama);
        const season = drama.seasons.find(s => s.season == params.season);
        const episode = season.episodes.find(e => e.episode == params.episode);

        Utils.qs('#playerTitle').innerText = `${drama.title} - S${params.season} E${params.episode}: ${episode.title}`;

        const video = Utils.qs('#videoPlayer');
        video.src = episode.video_url;

        let history = Utils.getFromStorage('history') || [];
        history = history.filter(d => d.id !== drama.id);
        history.unshift(drama);
        Utils.saveToStorage('history', history);

        const progressKey = `progress_${params.drama}_${params.season}_${params.episode}`;
        const savedTime = Utils.getFromStorage(progressKey);
        if(savedTime) {
            video.currentTime = savedTime;
            UI.showToast(`Resuming from ${Utils.formatTime(savedTime)}`);
        }

        app.player.setup(video, progressKey);
        this.setupNavButtons(params);
    }
};

// =========================================
// PLAYER LOGIC
// =========================================
const Player = {
    setup(video, storageKey) {
        const progressFill = Utils.qs('#progressFill');
        const progressBar = Utils.qs('#progressBar');
        const timeDisplay = Utils.qs('#timeDisplay');

        video.addEventListener('play', () => this.updatePlayIcon(true));
        video.addEventListener('pause', () => this.updatePlayIcon(false));
        
        video.addEventListener('timeupdate', () => {
            const percent = (video.currentTime / video.duration) * 100;
            progressFill.style.width = `${percent}%`;
            timeDisplay.innerText = `${Utils.formatTime(video.currentTime)} / ${Utils.formatTime(video.duration || 0)}`;
            
            if(Math.floor(video.currentTime) % 5 === 0) {
                Utils.saveToStorage(storageKey, video.currentTime);
            }
        });

        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            video.currentTime = pos * video.duration;
        });

        video.addEventListener('ended', () => {
            UI.showToast('Episode Completed');
            Utils.qs('#nextBtn').click();
        });
    },

    togglePlay() {
        const v = Utils.qs('#videoPlayer');
        if(v.paused) v.play(); else v.pause();
    },

    updatePlayIcon(isPlaying) {
        const btn = Utils.qs('.control-btn');
        if(btn) btn.innerText = isPlaying ? '⏸' : '▶';
    },

    toggleMute() {
        const v = Utils.qs('#videoPlayer');
        v.muted = !v.muted;
    },

    toggleFullscreen() {
        const v = Utils.qs('#videoPlayer');
        if (v.requestFullscreen) v.requestFullscreen();
        else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
    },

    handleAccessClick(accessKey) {
        window.open('https://example.com/sponsored-ad', '_blank');
        Utils.saveToStorage(accessKey, true);
        UI.showToast('Access Granted! Loading Player...');
        setTimeout(() => {
            app.router.refresh();
        }, 1500);
    }
};

// =========================================
// APP INITIALIZATION
// =========================================
const app = {
    data: DataService,
    ui: UI,
    router: Router,
    player: Player
};

app.ui.switchSeason = function(seasonNum) {
    const tabs = Utils.qsa('.season-tab');
    tabs.forEach(t => {
        t.classList.remove('active');
        if(t.innerText.includes(`Season ${seasonNum}`)) t.classList.add('active');
    });

    const params = Utils.getParams();
    DataService.getDramaById(params.drama).then(drama => {
        Utils.qs('#episodeList').innerHTML = app.router.generateEpisodesHtml(drama, seasonNum);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    app.router.init();
});
