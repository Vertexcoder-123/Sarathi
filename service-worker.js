const CACHE_NAME = 'gamified-learning-v3'; // Incremented version
const ASSET_CACHE_NAME = 'gamified-learning-assets-v1';

const CORE_ASSETS = [
    '/',
    // HTML Files
    'index.html',
    'teacher.html',

    // Core JSON
    'manifest.json',
    'missions.json',

    // Main Entry Points
    'main.js',
    'teacher_main.js',

    // Student-Side Scripts
    'studentDashboard.js',
    'gameProgress.js',
    'achievements.js',
    'game.js', // Base game file

    // Teacher-Side Scripts
    'teacherDashboard.js',

    // Shared Scripts
    'firebase-config.js',

    // All Game Scenes
    'scenes/interactiveQuiz.js',
    'scenes/matchingPairs.js',
    'scenes/simulationGame.js',
    'scenes/treasureHunt.js',
    'scenes/wordPuzzle.js'
];

const GAME_ASSETS = [
    'assets/ui/background.png',
    'assets/ui/button.png',
    'assets/audio/background-music.mp3',
    'assets/audio/correct.mp3',
    'assets/audio/wrong.mp3',
    'assets/games/matching-pairs/card.png',
    'assets/games/treasure-hunt/map.png',
    'assets/games/word-puzzle/letter-tile.png',
    'assets/games/simulation/character.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_NAME).then(cache => {
                console.log('Opened core asset cache');
                return cache.addAll(CORE_ASSETS);
            }),
            caches.open(ASSET_CACHE_NAME).then(cache => {
                console.log('Opened game asset cache');
                return cache.addAll(GAME_ASSETS);
            })
        ]).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== ASSET_CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Serve core assets from cache first
    if (CORE_ASSETS.includes(url.pathname)) {
        event.respondWith(
            caches.match(request).then(response => {
                return response || fetch(request).then(fetchResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, fetchResponse.clone());
                        return fetchResponse;
                    });
                });
            })
        );
        return;
    }

    // Serve game assets from cache first
    if (GAME_ASSETS.includes(url.pathname)) {
        event.respondWith(
            caches.match(request).then(response => {
                return response || fetch(request).then(fetchResponse => {
                    return caches.open(ASSET_CACHE_NAME).then(cache => {
                        cache.put(request, fetchResponse.clone());
                        return fetchResponse;
                    });
                });
            })
        );
        return;
    }

    // Network-first strategy for other requests
    event.respondWith(
        fetch(request).catch(() => {
            return caches.match(request).then(response => {
                if (response) {
                    return response;
                }
                // Optionally, return a fallback offline page
                // return caches.match('/offline.html');
            });
        })
    );
});

self.addEventListener('sync', event => {
    if (event.tag === 'sync-progress') {
        event.waitUntil(syncGameProgress());
    }
});

async function syncGameProgress() {
    const db = await openIndexedDB();
    const transaction = db.transaction(['progress'], 'readonly');
    const store = transaction.objectStore('progress');
    const progressData = await store.getAll();

    if (progressData.length > 0) {
        try {
            const response = await fetch('/api/sync-progress', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(progressData)
            });

            if (response.ok) {
                // Clear synced data from IndexedDB
                const clearTransaction = db.transaction(['progress'], 'readwrite');
                const clearStore = clearTransaction.objectStore('progress');
                await clearStore.clear();
                console.log('Game progress synced successfully');
            } else {
                console.error('Failed to sync game progress');
            }
        } catch (error) {
            console.error('Error syncing game progress:', error);
        }
    }
}

function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('gamified-learning-db', 1);

        request.onerror = () => {
            reject('Error opening IndexedDB');
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = event => {
            const db = event.target.result;
            db.createObjectStore('progress', { keyPath: 'id', autoIncrement: true });
        };
    });
}

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
