$(document).ready(function() {

    // ===================================================================
    // PENGATURAN & VARIABEL GLOBAL
    // ===================================================================

    let game;
    let comboTimer;
    let particles = [];
    let mouse = { x: 0, y: 0 };

    let gameState = {
        score: 0,
        health: 100,
        ammo: 30,
        wave: 1,
        combo: 0,
        isGameOver: false,
        isPaused: false,
        achievements: new Set()
    };

    let gameConfig = {
        currentMap: 'synth-grid'
    };

    const SETTINGS = {
        SHOOT_KNOCKBACK: 8,
        SHOOT_KNOCKBACKRESET: 0.3,
        PLAYER_SPEED: 1.2,
        BULLET_SPEED: 25,
        MAX_ENEMIES_PER_WAVE: 10,
        WAVE_ENEMY_MULTIPLIER: 1.5,
        COMBO_TIMEOUT: 2000
    };

    // ===================================================================
    // KELAS-KELAS OBJEK GAME (PLAYER, MUSUH, DLL)
    // ===================================================================

    class Controls {
        constructor() {
            this.keys = {};
            $(window).on('keydown', e => this.keys[e.key.toLowerCase()] = true);
            $(window).on('keyup', e => this.keys[e.key.toLowerCase()] = false);
            $(window).on('mousedown', () => this.keys['mousedown'] = true);
            $(window).on('mouseup', () => this.keys['mousedown'] = false);
        }
        isDown(key) {
            return this.keys[key] || false;
        }
    }

    class Player {
        constructor(options) {
            this.controls = options.controls;
            this.game = options.game;
            this.createElement(options.parentContainer);

            this.x = window.innerWidth / 2;
            this.y = window.innerHeight / 2;
            this.xvel = 0;
            this.yvel = 0;
            this.friction = 0.9;
            this.speed = SETTINGS.PLAYER_SPEED;
            this.scaleX = 1;
            this.width = 50;
            this.height = 60;
            this.maxHealth = 100;
            this.ammo = 30;
            this.maxAmmo = 30;
            this.speedBoost = 1;
            this.speedBoostTimer = 0;
            this.lastShot = 0;
            this.shootCooldown = 150;

            this.anim = {
                counter: 0,
                inc: Math.PI / 8,
                rightArm: { rot: 0, offsetX: 0, offsetY: 0 },
                leftArm: { rot: 0 },
                leftLeg: { rot: 0 },
                rightLeg: { rot: 0 },
                gun: { rot: 0 },
                lift: 0,
                knockback: 0,
            };
        }

        createElement(parentContainer) {
            this.el = $(`
                <div class="player">
                    <div class="body">
                       <div class='hat'></div>
                        <div class='eye right'></div>
                        <div class='eye left'></div>
                        <div class='mouth'></div>
                        <div class='shirt'>
                            <div class='under'></div>
                        </div>
                    </div>
                    <div class='arm right'>
                        <div class='gun'></div>
                    </div>
                    <div class='arm left'></div>
                    <div class='leg right'><div class='pant'></div></div>
                    <div class='leg left'><div class='pant'></div></div>
                </div>
            `);
            parentContainer.append(this.el);
        }

        takeDamage(damage) {
            gameState.health = Math.max(0, gameState.health - damage);
            if (gameState.health <= 0) {
                this.die();
            }
        }

        heal(amount) {
            gameState.health = Math.min(this.maxHealth, gameState.health + amount);
        }

        addAmmo(amount) {
            this.ammo = Math.min(this.maxAmmo, this.ammo + amount);
        }

        speedBoostPowerup() {
            this.speedBoost = 1.8;
            this.speedBoostTimer = 300;
        }

        die() {
            if (gameState.isGameOver) return;
            gameState.isGameOver = true;
            this.el.hide();
            createExplosion(this.x, this.y);
            $('#final-score').text(gameState.score);
            $('#game-over').fadeIn();
            $('.crosshair').hide();
            $('#pause-btn').hide();
        }

        shoot() {
            const now = Date.now();
            if (this.controls.isDown('mousedown') && this.ammo > 0 && now - this.lastShot > this.shootCooldown) {
                this.lastShot = now;
                this.ammo--;
                gameState.ammo = this.ammo;

                const gunTipX = this.x + this.anim.rightArm.offsetX;
                const gunTipY = this.y + this.anim.rightArm.offsetY;

                this.game.addBullet(new Bullet({
                    x: gunTipX,
                    y: gunTipY,
                    angle: this.anim.rightArm.rot,
                    parentContainer: this.game.container
                }));

                createFlash(gunTipX, gunTipY);
                createSmoke(gunTipX, gunTipY, 3);
                this.anim.knockback = SETTINGS.SHOOT_KNOCKBACK;
                $('.crosshair').addClass('active');
            } else {
                $('.crosshair').removeClass('active');
            }
        }

        move() {
            if (this.controls.isDown('a') || this.controls.isDown('arrowleft')) this.xvel -= this.speed * this.speedBoost;
            if (this.controls.isDown('d') || this.controls.isDown('arrowright')) this.xvel += this.speed * this.speedBoost;
            if (this.controls.isDown('w') || this.controls.isDown('arrowup')) this.yvel -= this.speed * this.speedBoost;
            if (this.controls.isDown('s') || this.controls.isDown('arrowdown')) this.yvel += this.speed * this.speedBoost;

            this.xvel *= this.friction;
            this.yvel *= this.friction;
            this.x += this.xvel;
            this.y += this.yvel;
        }

        aim() {
            const dx = mouse.x - this.x;
            const dy = mouse.y - this.y;
            this.anim.rightArm.rot = Math.atan2(dy, dx);
        }

        turn() {
            this.scaleX = (mouse.x < this.x) ? -1 : 1;
        }

        boundaries() {
            if (this.x < this.width / 2) this.x = this.width / 2;
            if (this.x > window.innerWidth - this.width / 2) this.x = window.innerWidth - this.width / 2;
            if (this.y < this.height / 2) this.y = this.height / 2;
            if (this.y > window.innerHeight - this.height / 2) this.y = window.innerHeight - this.height / 2;
        }

        animate() {
            const isMoving = Math.abs(this.xvel) + Math.abs(this.yvel) > 0.5;
            if (isMoving) {
                this.anim.counter += this.anim.inc;
                this.anim.lift = Math.sin(this.anim.counter) * 4;
                this.anim.leftArm.rot = Math.sin(this.anim.counter) / 2;
                this.anim.rightLeg.rot = Math.sin(this.anim.counter * 0.9) * 0.6;
                this.anim.leftLeg.rot = Math.sin(-this.anim.counter * 0.9) * 0.6;
            } else {
                const resetSpeed = 0.15;
                this.anim.leftArm.rot *= (1 - resetSpeed);
                this.anim.rightLeg.rot *= (1 - resetSpeed);
                this.anim.leftLeg.rot *= (1 - resetSpeed);
                this.anim.lift *= (1 - resetSpeed);
            }
            this.anim.knockback -= this.anim.knockback * SETTINGS.SHOOT_KNOCKBACKRESET;
            const armLength = 25;
            this.anim.rightArm.offsetX = Math.cos(this.anim.rightArm.rot) * armLength;
            this.anim.rightArm.offsetY = Math.sin(this.anim.rightArm.rot) * armLength;
        }

        updateEffects() {
            if (this.speedBoostTimer > 0) {
                this.speedBoostTimer--;
                if (this.speedBoostTimer <= 0) {
                    this.speedBoost = 1;
                }
            }
        }

        updateStyles() {
            this.el.css({
                top: this.y + this.anim.lift,
                left: this.x,
                transform: `translateX(-50%) translateY(-50%) scaleX(${this.scaleX})`
            });
            this.el.find('.arm.right').css('transform', `rotate(${this.anim.rightArm.rot}rad)`);
            this.el.find('.gun').css('transform', `translateX(${-this.anim.knockback}px)`);
            this.el.find('.arm.left').css('transform', `rotate(${this.anim.leftArm.rot}rad)`);
            this.el.find('.leg.right').css('transform', `translateX(-50%) rotate(${this.anim.rightLeg.rot}rad)`);
            this.el.find('.leg.left').css('transform', `translateX(-50%) rotate(${this.anim.leftLeg.rot}rad)`);
        }

        update() {
            if (gameState.isGameOver || gameState.isPaused) return;
            this.aim();
            this.turn();
            this.move();
            this.shoot();
            this.animate();
            this.boundaries();
            this.updateEffects();
            this.updateStyles();
        }
    }

    class Bullet {
        constructor(options) {
            this.x = options.x;
            this.y = options.y;
            this.angle = options.angle;
            this.el = $('<div class="bullet"></div>');
            options.parentContainer.append(this.el);
            this.update();
        }

        update() {
            this.x += Math.cos(this.angle) * SETTINGS.BULLET_SPEED;
            this.y += Math.sin(this.angle) * SETTINGS.BULLET_SPEED;
            this.el.css({
                left: this.x,
                top: this.y,
                transform: `translateX(-50%) translateY(-50%) rotate(${this.angle}rad)`
            });
        }

        remove() {
            this.el.remove();
        }
    }

    class Enemy {
        constructor(options) {
            this.game = options.game;
            this.player = options.player;
            const edge = Math.floor(Math.random() * 4);
            if (edge === 0) {
                this.x = Math.random() * window.innerWidth;
                this.y = -50;
            } else if (edge === 1) {
                this.x = window.innerWidth + 50;
                this.y = Math.random() * window.innerHeight;
            } else if (edge === 2) {
                this.x = Math.random() * window.innerWidth;
                this.y = window.innerHeight + 50;
            } else {
                this.x = -50;
                this.y = Math.random() * window.innerHeight;
            }
            this.type = ['jimmy', 'tank', 'speedy'][Math.floor(Math.random() * 3)];
            this.setPropertiesByType();
            this.el = $(`<div class="enemy ${this.type}"><div class="eye right"></div><div class="eye left"></div></div>`);
            options.parentContainer.append(this.el);
        }

        setPropertiesByType() {
            switch (this.type) {
                case 'tank':
                    this.health = 50 + gameState.wave * 5;
                    this.speed = 0.5 + gameState.wave * 0.05;
                    this.score = 20;
                    this.damage = 20;
                    break;
                case 'speedy':
                    this.health = 10 + gameState.wave * 2;
                    this.speed = 1.5 + gameState.wave * 0.1;
                    this.score = 15;
                    this.damage = 5;
                    break;
                default:
                    this.health = 20 + gameState.wave * 3;
                    this.speed = 1 + gameState.wave * 0.08;
                    this.score = 10;
                    this.damage = 10;
                    break;
            }
        }

        takeDamage(damage) {
            this.health -= damage;
            showDamageNumber(this.x, this.y, damage);
            this.el.addClass('hit');
            setTimeout(() => this.el.removeClass('hit'), 300);
            if (this.health <= 0) {
                this.die();
                return true;
            }
            return false;
        }

        die() {
            gameState.score += this.score * (1 + Math.floor(gameState.combo / 5));
            gameState.combo++;
            clearTimeout(comboTimer);
            showCombo();
            comboTimer = setTimeout(() => {
                gameState.combo = 0;
            }, SETTINGS.COMBO_TIMEOUT);
            createExplosion(this.x, this.y);
            this.el.addClass('dying');
            setTimeout(() => this.el.remove(), 500);
        }

        update() {
            const dx = this.player.x - this.x;
            const dy = this.player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
            this.el.css({
                left: this.x,
                top: this.y,
                transform: `translateX(-50%) translateY(-50%) rotate(${Math.atan2(dy,dx)}rad)`
            });
        }

        remove() {
            this.el.remove();
        }
    }

    class Powerup {
        constructor(options) {
            this.x = options.x;
            this.y = options.y;
            if (options.forceType) {
                this.type = options.forceType;
            } else {
                const lootTable = ['ammo', 'ammo', 'ammo', 'health', 'speed'];
                this.type = lootTable[Math.floor(Math.random() * lootTable.length)];
            }
            this.el = $(`<div class="powerup ${this.type}"></div>`);
            options.parentContainer.append(this.el);
            this.el.css({ left: this.x, top: this.y });
        }

        apply(player) {
            switch (this.type) {
                case 'health':
                    player.heal(30);
                    break;
                case 'ammo':
                    player.addAmmo(30);
                    break;
                case 'speed':
                    player.speedBoostPowerup();
                    break;
            }
        }

        remove() {
            this.el.remove();
        }
    }

    class Game {
        constructor() {
            this.container = $('.container');
            this.controls = new Controls();
            this.player = new Player({
                controls: this.controls,
                parentContainer: this.container,
                game: this
            });
            this.bullets = [];
            this.enemies = [];
            this.powerups = [];
            this.enemiesToSpawn = 0;
            this.lastSpawn = 0;
            this.isSpawningWave = true;
            showWaveStartAnimation(gameState.wave, () => {
                this.startWave();
                this.isSpawningWave = false;
            });
        }

        startWave() {
            this.enemiesToSpawn = Math.floor(SETTINGS.MAX_ENEMIES_PER_WAVE * (1 + (gameState.wave - 1) / 2));
        }

        addBullet(bullet) {
            this.bullets.push(bullet);
        }

        spawnEnemy() {
            if (this.enemiesToSpawn > 0 && this.enemies.length < SETTINGS.MAX_ENEMIES_PER_WAVE * 2) {
                this.enemies.push(new Enemy({
                    game: this,
                    player: this.player,
                    parentContainer: this.container
                }));
                this.enemiesToSpawn--;
            }
        }

        spawnPowerup(x, y) {
            if (Math.random() < 0.3) {
                this.powerups.push(new Powerup({
                    x: x,
                    y: y,
                    parentContainer: this.container
                }));
            }
        }

        checkCollisions() {
            this.bullets.forEach((bullet, bIndex) => {
                this.enemies.forEach((enemy, eIndex) => {
                    if (!bullet || !enemy) return;
                    const dx = bullet.x - enemy.x;
                    const dy = bullet.y - enemy.y;
                    if (Math.sqrt(dx * dx + dy * dy) < 30) {
                        bullet.remove();
                        this.bullets.splice(bIndex, 1);
                        if (enemy.takeDamage(10)) {
                            this.spawnPowerup(enemy.x, enemy.y);
                            this.enemies.splice(eIndex, 1);
                        }
                    }
                });
            });

            this.enemies.forEach((enemy, eIndex) => {
                if (!this.player || !enemy) return;
                const dx = this.player.x - enemy.x;
                const dy = this.player.y - enemy.y;
                if (Math.sqrt(dx * dx + dy * dy) < 40) {
                    enemy.die();
                    this.enemies.splice(eIndex, 1);
                    this.player.takeDamage(enemy.damage);
                }
            });

            this.powerups.forEach((powerup, pIndex) => {
                if (!this.player || !powerup) return;
                const dx = this.player.x - powerup.x;
                const dy = this.player.y - powerup.y;
                if (Math.sqrt(dx * dx + dy * dy) < 40) {
                    powerup.apply(this.player);
                    powerup.remove();
                    this.powerups.splice(pIndex, 1);
                }
            });
        }

        loop() {
            if (gameState.isGameOver || gameState.isPaused) {
                return;
            }

            this.player.update();
            this.bullets.forEach((b, i) => {
                if (!b) return;
                b.update();
                if (b.x < 0 || b.x > window.innerWidth || b.y < 0 || b.y > window.innerHeight) {
                    b.remove();
                    this.bullets.splice(i, 1);
                }
            });
            this.enemies.forEach(e => {
                if (e) e.update()
            });

            const now = Date.now();
            if (now - this.lastSpawn > 1000) {
                this.lastSpawn = now;
                this.spawnEnemy();
            }

            this.checkCollisions();

            if (this.enemiesToSpawn <= 0 && this.enemies.length === 0 && !this.isSpawningWave) {
                this.isSpawningWave = true;
                gameState.wave++;
                showWaveStartAnimation(gameState.wave, () => {
                    this.startWave();
                    this.isSpawningWave = false;
                });
            }

            updateUI();
            updateCrosshair();
            checkAchievements();

            requestAnimationFrame(this.loop.bind(this));
        }
    }

    // ===================================================================
    // FUNGSI BANTU & EFEK VISUAL
    // ===================================================================

    function showWaveStartAnimation(waveNumber, callback) {
        const indicator = $('#wave-start-indicator');
        $('#wave-start-text').text(`WAVE ${waveNumber} START`);
        indicator.addClass('show');
        setTimeout(() => {
            indicator.removeClass('show');
            if (callback) {
                callback();
            }
        }, 2500);
    }

    function createParticles() {
        setInterval(() => {
            if (gameState.isGameOver || particles.length >= 50) return;
            const particle = $('<div class="particle"></div>');
            particle.css({
                left: Math.random() * window.innerWidth,
                animationDelay: Math.random() * 5 + 's',
                animationDuration: (Math.random() * 3 + 2) + 's'
            });
            $('.background').append(particle);
            particles.push(particle);
            setTimeout(() => {
                particle.remove();
                particles = particles.filter(p => p !== particle);
            }, 5000);
        }, 100);
    }

    function updateCrosshair() {
        if (gameState.isGameOver) return;
        $('.crosshair').css({ left: mouse.x, top: mouse.y });
    }

    function showDamageNumber(x, y, damage) {
        const damageEl = $(`<div class="damage-number">-${damage}</div>`);
        damageEl.css({ left: x, top: y });
        $('.container').append(damageEl);
        setTimeout(() => damageEl.remove(), 1000);
    }

    function createExplosion(x, y) {
        const explosion = $('<div class="explosion"></div>');
        explosion.css({ left: x, top: y });
        $('.container').append(explosion);
        setTimeout(() => explosion.remove(), 500);
    }

    function showCombo() {
        if (gameState.combo > 2) {
            const comboEl = $(`<div class="combo">COMBO x${gameState.combo}!</div>`);
            $('body').append(comboEl);
            setTimeout(() => comboEl.remove(), 1000);
        }
    }

    function checkAchievements() {
        if (gameState.score >= 1000 && !gameState.achievements.has("Novice Slayer")) {
            showAchievement("Novice Slayer (1000 Pts)");
            gameState.achievements.add("Novice Slayer");
        }
        if (gameState.wave >= 5 && !gameState.achievements.has("Wave Master")) {
            showAchievement("Wave Master (Wave 5)");
            gameState.achievements.add("Wave Master");
        }
        if (gameState.combo >= 10 && !gameState.achievements.has("Combo King")) {
            showAchievement("Combo King (x10 Combo)");
            gameState.achievements.add("Combo King");
        }
    }

    function showAchievement(text) {
        const achievement = $(`<div class="achievement">🏆 Achievement: ${text}</div>`);
        $('body').append(achievement);
        setTimeout(() => achievement.remove(), 4000);
    }

    function createFlash(x, y) {
        const flash = $('<div class="flash"></div>').css({ left: x, top: y });
        $('.container').append(flash);
        setTimeout(() => flash.remove(), 200);
    }

    function createSmoke(x, y, count) {
        for (let i = 0; i < count; i++) {
            const size = Math.random() * 20 + 10;
            const cloud = $('<div class="cloud"></div>').css({
                left: x + (Math.random() - 0.5) * 30,
                top: y + (Math.random() - 0.5) * 30,
                width: size,
                height: size,
                animationDuration: (Math.random() * 0.5 + 0.5) + 's'
            });
            $('.container').append(cloud);
            setTimeout(() => cloud.remove(), 1000);
        }
    }

    function updateUI() {
        $('#score').text(gameState.score);
        $('#health-fill').css('width', gameState.health + '%');
        $('#ammo').text(game.player.ammo);
        $('#wave').text(gameState.wave);
    }

    // ===================================================================
    // LOGIKA UTAMA & INISIALISASI
    // ===================================================================

    function startGame() {
        gameState = {
            score: 0,
            health: 100,
            ammo: 30,
            wave: 1,
            combo: 0,
            isGameOver: false,
            isPaused: false,
            achievements: new Set()
        };
        $('.container').empty();
        $('.game-over').hide();
        $('.crosshair').show();
        $('#pause-btn').show();
        game = new Game();
        game.loop();
    }
    
    function init() {
        // Event Listeners untuk semua tombol
        $('#play-btn').on('click', () => {
            $('#main-menu').fadeOut(500, startGame);
        });
        $('#tutorial-btn').on('click', () => $('#tutorial-screen').fadeIn());
        $('#map-btn').on('click', () => $('#map-screen').fadeIn());
        $('.modal-close-btn').on('click', () => $('.modal-screen').fadeOut());
        $('#pause-btn').on('click', () => {
            if (gameState.isGameOver) return;
            gameState.isPaused = true;
            $('#pause-menu').fadeIn();
        });
        $('#resume-btn').on('click', () => {
            gameState.isPaused = false;
            $('#pause-menu').fadeOut();
            requestAnimationFrame(game.loop.bind(game));
        });
        $('#main-menu-btn').on('click', () => location.reload());
        $('#restart-btn').on('click', startGame);

        $('.map-choice').on('click', function() {
            const selectedMap = $(this).data('map');
            gameConfig.currentMap = selectedMap;
            // Hapus semua kelas peta yang mungkin ada
            $('body').removeClass('map-synth-grid map-neon-forest map-volcanic-core');
            // Tambahkan kelas yang dipilih
            $('body').addClass(selectedMap);
            $('.map-choice').removeClass('selected');
            $(this).addClass('selected');
        });

        $(window).on('mousemove', e => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });

        // Pengaturan awal saat halaman dimuat
        $('.map-choice[data-map="synth-grid"]').addClass('selected');
        $('body').addClass('map-synth-grid');
        createParticles();
    }

    init();
});