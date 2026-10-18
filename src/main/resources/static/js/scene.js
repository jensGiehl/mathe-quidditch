const TAU = Math.PI * 2;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const mix = (start, end, amount) => start + (end - start) * amount;
const ease = value => value * value * (3 - 2 * value);
const random = seed => {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
};
const palettes = {
    gryffindor: { primary: '#9e3043', secondary: '#ecc26d', dark: '#4e182b' },
    slytherin: { primary: '#267561', secondary: '#d7e2d5', dark: '#123b35' },
    ravenclaw: { primary: '#325f9b', secondary: '#d9ad72', dark: '#182b54' },
    hufflepuff: { primary: '#d1a33f', secondary: '#343442', dark: '#695019' }
};
const crowdColors = ['#982f46', '#daa845', '#2e7367', '#45638b', '#a2826a', '#c5c4ac', '#634c7b', '#e2c88c', '#6d8490', '#703d4e'];
const skinColors = ['#e8bb91', '#bd805d', '#87553e', '#f0ccad', '#bd9376', '#6c4337'];

export class QuidditchScene {
    constructor(canvas) {
        this.canvas = canvas;
        this.context = canvas.getContext('2d', { alpha: false });
        this.width = 1;
        this.height = 1;
        this.time = 0;
        this.lastFrame = 0;
        this.paused = false;
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.state = { phase: 'lobby', progress: 0, lane: 1, answers: [], boost: false, house: 'gryffindor' };
        this.currentLane = 1;
        this.rewards = [];
        this.rewardIds = new Set();
        this.cheerStarted = -10;
        this.landingStarted = -10;
        this.backdrop = null;
        this.destroyed = false;
        this.resize = this.resize.bind(this);
        this.frame = this.frame.bind(this);
        this.resizeObserver = new ResizeObserver(this.resize);
        this.resizeObserver.observe(canvas);
        this.loadBackdrop('/assets/stadium.png', true);
        this.resize();
        this.frameId = requestAnimationFrame(this.frame);
    }

    loadBackdrop(source, fallback) {
        const image = new Image();
        image.onload = () => {
            if (!this.destroyed) this.backdrop = image;
        };
        image.onerror = () => {
            if (fallback && !this.destroyed) this.loadBackdrop('/assets/stadium.webp', false);
        };
        image.src = source;
    }

    resize() {
        const bounds = this.canvas.getBoundingClientRect();
        this.width = Math.max(1, bounds.width);
        this.height = Math.max(1, bounds.height);
        this.ratio = Math.min(window.devicePixelRatio || 1, 1.75);
        this.canvas.width = Math.round(this.width * this.ratio);
        this.canvas.height = Math.round(this.height * this.ratio);
    }

    setState(next) {
        if ((next.phase === 'lobby' && this.state.phase !== 'lobby') || (next.phase === 'playing' && this.state.phase === 'finished')) {
            this.rewards = [];
            this.rewardIds.clear();
            this.cheerStarted = -10;
            this.landingStarted = -10;
        }
        this.state = { ...this.state, ...next };
        this.state.lane = clamp(Number(this.state.lane) || 0, 0, 2);
        this.state.progress = clamp(Number(this.state.progress) || 0, 0, 1);
        if (next.phase === 'playing') this.landingStarted = -10;
    }

    reward({ id, correctCount = 0, milestone = false, variant } = {}) {
        const identifier = id ?? `correct-${correctCount}`;
        if (this.rewardIds.has(identifier)) return;
        this.rewardIds.add(identifier);
        const magic = milestone || (correctCount > 0 && correctCount % 10 === 0);
        const index = Number.isFinite(Number(variant)) ? Number(variant) : Math.max(0, Math.floor(correctCount / 10) - 1);
        this.rewards.push({ id: identifier, start: this.time, milestone: magic, variant: index % 3, seed: correctCount * 7.31 + this.rewardIds.size, direction: this.rewardIds.size % 2 ? 1 : -1 });
        this.rewards = this.rewards.slice(-4);
        this.cheerStarted = this.time;
    }

    land() {
        this.landingStarted = this.time;
    }

    setPaused(paused) {
        this.paused = Boolean(paused);
        this.lastFrame = 0;
    }

    setReducedMotion(reducedMotion) {
        this.reducedMotion = Boolean(reducedMotion);
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.frameId);
        this.resizeObserver.disconnect();
    }

    frame(timestamp) {
        if (this.destroyed) return;
        const delta = this.lastFrame ? Math.min((timestamp - this.lastFrame) / 1000, 0.05) : 0;
        this.lastFrame = timestamp;
        if (!this.paused && !document.hidden) {
            this.time += delta;
            const smoothing = this.reducedMotion ? 1 : 1 - Math.exp(-delta * 10);
            this.currentLane = mix(this.currentLane, this.state.lane, smoothing);
            this.rewards = this.rewards.filter(reward => this.time - reward.start < 1.8);
        }
        this.draw();
        this.frameId = requestAnimationFrame(this.frame);
    }

    get palette() {
        if (this.state.house && typeof this.state.house === 'object') return { ...palettes.gryffindor, ...this.state.house };
        const house = String(this.state.house || '').toLowerCase();
        const aliases = { red: 'gryffindor', green: 'slytherin', blue: 'ravenclaw', yellow: 'hufflepuff', gryffindor: 'gryffindor', griffindor: 'gryffindor', slytherin: 'slytherin', ravenclaw: 'ravenclaw', hufflepuff: 'hufflepuff' };
        return palettes[aliases[house]] || palettes.gryffindor;
    }

    path(points, fill, stroke, width = 1) {
        const context = this.context;
        context.beginPath();
        points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
        context.closePath();
        if (fill) {
            context.fillStyle = fill;
            context.fill();
        }
        if (stroke) {
            context.strokeStyle = stroke;
            context.lineWidth = width;
            context.stroke();
        }
    }

    ellipse(x, y, radiusX, radiusY, fill, stroke, width = 1, rotation = 0) {
        const context = this.context;
        context.beginPath();
        context.ellipse(x, y, radiusX, radiusY, rotation, 0, TAU);
        if (fill) {
            context.fillStyle = fill;
            context.fill();
        }
        if (stroke) {
            context.strokeStyle = stroke;
            context.lineWidth = width;
            context.stroke();
        }
    }

    line(points, color, width = 1) {
        const context = this.context;
        context.beginPath();
        points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
        context.strokeStyle = color;
        context.lineWidth = width;
        context.stroke();
    }

    glow(x, y, radius, color, alpha = 1) {
        const context = this.context;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'transparent');
        context.globalAlpha = alpha;
        context.fillStyle = gradient;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        context.globalAlpha = 1;
    }

    draw() {
        const context = this.context;
        const width = this.width;
        const height = this.height;
        context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        this.drawBackground();
        this.drawField();
        this.drawStadium();
        this.drawFlightLanes();
        this.drawAir();
        this.drawGates();
        this.drawWizard();
        this.drawRewards();
        const vignette = context.createRadialGradient(width * 0.5, height * 0.45, width * 0.15, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
        vignette.addColorStop(0, 'rgba(6,19,34,0)');
        vignette.addColorStop(1, 'rgba(5,16,30,.38)');
        context.fillStyle = vignette;
        context.fillRect(0, 0, width, height);
    }

    drawBackground() {
        const context = this.context;
        const width = this.width;
        const height = this.height;
        const sky = context.createLinearGradient(0, 0, 0, height * 0.55);
        sky.addColorStop(0, '#132a46');
        sky.addColorStop(0.42, '#597183');
        sky.addColorStop(0.78, '#d4af83');
        sky.addColorStop(1, '#e9c990');
        context.fillStyle = sky;
        context.fillRect(0, 0, width, height);
        if (this.backdrop) {
            const scale = Math.max(width / this.backdrop.width, height / this.backdrop.height);
            const imageWidth = this.backdrop.width * scale;
            const imageHeight = this.backdrop.height * scale;
            context.drawImage(this.backdrop, (width - imageWidth) * 0.5, (height - imageHeight) * 0.45, imageWidth, imageHeight);
            const tint = context.createLinearGradient(0, 0, 0, height);
            tint.addColorStop(0, 'rgba(8,28,49,.18)');
            tint.addColorStop(0.5, 'rgba(13,34,41,.06)');
            tint.addColorStop(1, 'rgba(5,30,28,.4)');
            context.fillStyle = tint;
            context.fillRect(0, 0, width, height);
        } else {
            this.glow(width * 0.76, height * 0.18, width * 0.38, 'rgba(255,220,153,.48)');
            this.ellipse(width * 0.77, height * 0.19, 20, 20, '#f4d89e');
            this.drawClouds();
            this.drawCastle();
        }
        for (let index = 0; index < 18; index++) {
            const x = random(index * 3 + 2) * width;
            const y = random(index * 4 + 4) * height * 0.25;
            const opacity = 0.18 + Math.sin(this.time * 0.6 + index) * 0.08;
            this.ellipse(x, y, 0.7, 0.7, `rgba(255,237,193,${opacity})`);
        }
        const mist = context.createLinearGradient(0, height * 0.26, 0, height * 0.43);
        mist.addColorStop(0, 'rgba(231,201,156,0)');
        mist.addColorStop(0.5, 'rgba(240,207,158,.13)');
        mist.addColorStop(1, 'rgba(231,201,156,0)');
        context.fillStyle = mist;
        context.fillRect(0, height * 0.26, width, height * 0.17);
    }

    drawClouds() {
        const context = this.context;
        const width = this.width;
        const height = this.height;
        context.save();
        for (let index = 0; index < 9; index++) {
            const drift = this.reducedMotion ? 0 : this.time * 0.7;
            const x = ((random(index + 17) * width * 1.4 + drift) % (width * 1.4)) - width * 0.2;
            const y = height * (0.04 + random(index + 23) * 0.19);
            const cloudWidth = width * (0.08 + random(index + 40) * 0.14);
            const gradient = context.createRadialGradient(x, y, 2, x, y, cloudWidth);
            gradient.addColorStop(0, 'rgba(234,206,179,.20)');
            gradient.addColorStop(1, 'rgba(234,206,179,0)');
            context.save();
            context.translate(x, y);
            context.scale(1, 0.2);
            context.fillStyle = gradient;
            context.fillRect(-width, -height, width * 2, height * 2);
            context.restore();
        }
        context.restore();
    }

    drawCastle() {
        const width = this.width;
        const height = this.height;
        this.path([[0, height * 0.31], [width * 0.08, height * 0.26], [width * 0.17, height * 0.29], [width * 0.28, height * 0.22], [width * 0.4, height * 0.3], [width * 0.58, height * 0.24], [width * 0.73, height * 0.28], [width * 0.9, height * 0.25], [width, height * 0.3], [width, height * 0.43], [0, height * 0.43]], '#687680');
        const base = height * 0.32;
        const castleX = width * 0.52;
        const scale = Math.min(width / 950, height / 530);
        const context = this.context;
        context.save();
        context.translate(castleX, base);
        context.scale(scale, scale);
        const towers = [[-113, 60, 20], [-83, 80, 18], [-49, 61, 22], [-17, 112, 20], [15, 70, 22], [52, 92, 17], [80, 51, 21], [109, 67, 17]];
        context.fillStyle = '#52606a';
        context.fillRect(-122, -32, 243, 43);
        this.path([[-96, -36], [-47, -67], [18, -36]], '#485866');
        towers.forEach(([x, towerHeight, towerWidth], index) => {
            const top = -towerHeight;
            context.fillStyle = index % 2 ? '#4c5c68' : '#56636d';
            context.fillRect(x, top, towerWidth, towerHeight);
            this.path([[x - 4, top], [x + towerWidth / 2, top - 30 - index % 3 * 7], [x + towerWidth + 4, top]], '#344b60');
            this.line([[x + towerWidth / 2, top - 30 - index % 3 * 7], [x + towerWidth / 2, top - 41 - index % 3 * 7]], '#344b60', 1);
            for (let windowIndex = 0; windowIndex < 3; windowIndex++) {
                context.fillStyle = 'rgba(247,208,133,.45)';
                context.fillRect(x + towerWidth / 2 - 1, top + 11 + windowIndex * 14, 2, 5);
            }
        });
        context.restore();
    }

    drawField() {
        const context = this.context;
        const width = this.width;
        const height = this.height;
        const horizon = height * 0.345;
        const field = context.createLinearGradient(0, horizon, 0, height);
        field.addColorStop(0, '#5e805e');
        field.addColorStop(0.3, '#3b7254');
        field.addColorStop(1, '#173f39');
        if (this.backdrop) {
            field.addColorStop(0.05, 'rgba(67,109,70,.85)');
        }
        this.path([[width * 0.32, horizon], [width * 0.68, horizon], [width * 1.04, height], [-width * 0.04, height]], field);
        context.save();
        this.path([[width * 0.32, horizon], [width * 0.68, horizon], [width * 1.04, height], [-width * 0.04, height]]);
        context.clip();
        const movement = this.reducedMotion || this.state.phase !== 'playing' ? this.time * 0.06 : this.time * (this.state.boost ? 0.8 : 0.27);
        for (let stripe = 0; stripe < 13; stripe++) {
            const depth = ((stripe / 13 + movement * 0.08) % 1);
            const near = Math.pow(depth, 2);
            const next = Math.pow(Math.min(1, depth + 0.045), 2);
            const y = mix(horizon, height * 1.1, near);
            const nextY = mix(horizon, height * 1.1, next);
            context.fillStyle = 'rgba(159,179,108,.09)';
            context.fillRect(0, y, width, nextY - y);
        }
        this.ellipse(width * 0.5, height * 0.68, width * 0.32, height * 0.105, null, 'rgba(221,223,171,.16)', 2);
        this.ellipse(width * 0.5, height * 0.68, width * 0.004, height * 0.002, '#c1c7a2');
        this.line([[width * 0.5, horizon], [width * 0.5, height]], 'rgba(221,223,171,.12)', 1.5);
        this.line([[width * 0.37, horizon], [-width * 0.13, height]], 'rgba(221,223,171,.20)', 2);
        this.line([[width * 0.63, horizon], [width * 1.13, height]], 'rgba(221,223,171,.20)', 2);
        context.restore();
        this.drawHoops();
        const haze = context.createLinearGradient(0, horizon, 0, height * 0.5);
        haze.addColorStop(0, 'rgba(225,204,156,.24)');
        haze.addColorStop(1, 'rgba(225,204,156,0)');
        context.fillStyle = haze;
        context.fillRect(width * 0.3, horizon, width * 0.4, height * 0.2);
    }

    drawHoops() {
        const width = this.width;
        const height = this.height;
        const scale = clamp(width / 1000, 0.55, 1.3);
        [-1, 0, 1].forEach((offset, index) => {
            const x = width * 0.5 + offset * 33 * scale;
            const y = height * 0.35 - (index === 1 ? 35 : 23) * scale;
            this.line([[x, y + 10 * scale], [x, height * 0.42]], '#9a895e', 2.8 * scale);
            this.ellipse(x, y, 10 * scale, 14 * scale, 'rgba(244,213,152,.035)', '#d7bb76', 3 * scale);
            this.ellipse(x - scale, y - scale, 8 * scale, 12 * scale, null, 'rgba(255,234,181,.35)', scale);
        });
    }

    drawStadium() {
        const context = this.context;
        const width = this.width;
        const height = this.height;
        const far = height * 0.315;
        this.path([[0, far - 15], [width * 0.25, far - 5], [width * 0.4, far + 10], [width * 0.6, far + 10], [width * 0.75, far - 5], [width, far - 15], [width, far + 34], [width * 0.6, far + 35], [width * 0.4, far + 35], [0, far + 34]], '#32434a');
        for (let index = 0; index < 80; index++) {
            const x = (index + 0.5) / 80 * width;
            const y = far + 11 + Math.sin(index * 0.07) * 7;
            this.ellipse(x, y, 1.6, 2, crowdColors[index % crowdColors.length]);
            this.ellipse(x + 1, y + 8, 1.5, 2, crowdColors[(index + 3) % crowdColors.length]);
        }
        [false, true].forEach(right => {
            context.save();
            if (right) {
                context.translate(width, 0);
                context.scale(-1, 1);
            }
            const stone = context.createLinearGradient(0, height * 0.3, width * 0.24, height * 0.8);
            stone.addColorStop(0, '#516063');
            stone.addColorStop(1, '#172f3c');
            this.path([[0, height * 0.295], [width * 0.325, height * 0.345], [width * 0.09, height * 0.81], [0, height * 0.85]], stone, 'rgba(236,210,157,.16)', 1);
            for (let row = 0; row < 10; row++) {
                const depth = row / 9;
                const y = height * (0.34 + depth * 0.21 + depth * depth * 0.16);
                const edge = width * (0.32 - depth * 0.195);
                this.path([[0, y + 4], [edge, y - height * 0.003], [edge - width * 0.01, y + height * 0.017], [0, y + height * 0.023]], row % 2 ? '#273c45' : '#354b50');
                this.line([[0, y + height * 0.024], [edge - width * 0.01, y + height * 0.017]], 'rgba(214,193,146,.22)', 1);
                const count = Math.floor(12 + depth * 3 + width / 95);
                for (let spectator = 0; spectator < count; spectator++) {
                    const seed = row * 101 + spectator * 7 + (right ? 2000 : 0);
                    const x = (spectator + 0.4 + random(seed) * 0.2) / count * edge;
                    const spectatorY = y + (1 - x / edge) * height * 0.006;
                    const size = clamp(1.25 + depth * 3.2 + width / 850, 1.8, 5.4);
                    this.drawSpectator(x, spectatorY, size, seed, right);
                }
            }
            this.line([[0, height * 0.77], [width * 0.11, height * 0.75], [width * 0.32, height * 0.355]], '#9b9177', 3);
            for (let support = 0; support < 6; support++) {
                const depth = support / 5;
                const x = width * mix(0.3, 0.1, depth);
                const y = height * mix(0.39, 0.76, depth);
                this.line([[x, y], [x, y - 12 - depth * 16]], '#b0a185', 1.5);
            }
            [0, 1, 2, 3].forEach(index => this.drawTower(width * (0.025 + index * 0.072), height * (0.31 + (3 - index) * 0.019), clamp(width / 1250, 0.42, 0.88) * (1.45 - index * 0.19), index + (right ? 2 : 0)));
            context.restore();
        });
    }

    drawSpectator(x, y, size, seed) {
        const context = this.context;
        const elapsed = this.time - this.cheerStarted - (seed % 7) * 0.025;
        const active = elapsed >= 0 && elapsed < 0.95;
        const strength = active ? Math.sin(clamp(elapsed / 0.85, 0, 1) * Math.PI) : 0;
        const jump = this.reducedMotion ? strength * size * 0.35 : strength * Math.max(0, Math.sin(elapsed * 18 + seed)) * size * 1.5;
        const sway = this.reducedMotion ? 0 : Math.sin(this.time * 1.2 + seed) * size * 0.12;
        const top = y - jump;
        context.lineWidth = size * 0.65;
        context.strokeStyle = crowdColors[Math.floor(random(seed + 3) * crowdColors.length)];
        context.beginPath();
        context.moveTo(x + sway, top + size * 1.3);
        context.lineTo(x + sway, top + size * 3.2);
        context.stroke();
        const leftArm = top + size * (2.1 - strength * 3.4);
        const rightArm = top + size * (2.1 - strength * 3.0);
        this.line([[x - size, leftArm], [x + sway, top + size * 1.8], [x + size, rightArm]], context.strokeStyle, size * 0.45);
        this.ellipse(x + sway, top + size * 0.4, size * 0.58, size * 0.7, skinColors[Math.floor(random(seed + 5) * skinColors.length)]);
        if (seed % 5 === 0) this.ellipse(x + sway, top, size * 0.72, size * 0.3, crowdColors[seed % crowdColors.length]);
        if (seed % 13 === 0) {
            const flagX = x + size * 1.3;
            const flagY = top - size * (1.1 + strength * 2.2);
            const wave = Math.sin(this.time * (active ? 13 : 3) + seed) * size * (active ? 0.7 : 0.25);
            this.line([[flagX, top + size * 2], [flagX, flagY - size * 1.5]], '#cfb78b', size * 0.22);
            this.path([[flagX, flagY - size * 1.5], [flagX + size * 2.4, flagY - size + wave], [flagX + size * 2.3, flagY + size * 0.2 + wave], [flagX, flagY]], crowdColors[(seed + 2) % crowdColors.length]);
        }
    }

    drawTower(x, y, scale, seed) {
        const context = this.context;
        const colors = Object.values(palettes)[seed % 4];
        context.save();
        context.translate(x, y);
        context.scale(scale, scale);
        const gradient = context.createLinearGradient(-20, 0, 20, 0);
        gradient.addColorStop(0, '#253744');
        gradient.addColorStop(0.45, '#627078');
        gradient.addColorStop(1, '#283d47');
        context.fillStyle = gradient;
        context.fillRect(-18, -64, 36, 101);
        this.path([[-27, -64], [0, -99], [27, -64]], colors.dark, colors.secondary, 1);
        this.line([[0, -99], [0, -126]], '#bbaa7d', 1.5);
        const wave = this.reducedMotion ? 2 : Math.sin(this.time * 2.6 + seed) * 5;
        this.path([[0, -125], [28, -120 + wave], [22, -110 + wave], [0, -113]], colors.primary, 'rgba(255,222,148,.3)', 0.5);
        for (let windowIndex = 0; windowIndex < 3; windowIndex++) {
            context.fillStyle = '#142a39';
            context.fillRect(-12 + windowIndex * 10, -54, 5, 13);
            this.ellipse(-9.5 + windowIndex * 10, -54, 2.5, 3, '#142a39');
        }
        this.path([[-12, -32], [12, -32], [12, 11], [0, 23], [-12, 11]], colors.primary, colors.secondary, 1);
        this.ellipse(0, -12, 6, 8, null, colors.secondary, 1.3);
        this.path([[-3, -17], [4, -15], [2, -8], [-3, -7]], colors.secondary);
        this.line([[-23, -35], [23, -35]], '#9d9c8b', 3);
        this.line([[-22, 28], [22, 28]], '#576571', 3);
        context.restore();
    }

    lanePoint(lane, depth) {
        return { x: this.width * (0.5 + (lane - 1) * mix(0.095, 0.31, depth)), y: this.height * mix(0.35, 0.98, depth * depth) };
    }

    drawFlightLanes() {
        const context = this.context;
        const width = this.width;
        const height = this.height;
        for (let lane = 0; lane < 3; lane++) {
            const selected = Math.abs(this.currentLane - lane) < 0.5;
            const top = this.lanePoint(lane, 0);
            const bottom = this.lanePoint(lane, 1);
            const laneGlow = context.createLinearGradient(0, height * 0.38, 0, height);
            laneGlow.addColorStop(0, 'rgba(226,209,151,0)');
            laneGlow.addColorStop(0.5, selected ? 'rgba(231,205,126,.06)' : 'rgba(170,220,204,.015)');
            laneGlow.addColorStop(1, selected ? 'rgba(242,210,127,.16)' : 'rgba(170,220,204,.035)');
            this.path([[top.x - width * 0.018, top.y], [top.x + width * 0.018, top.y], [bottom.x + width * 0.11, height], [bottom.x - width * 0.11, height]], laneGlow);
            const movement = this.reducedMotion ? 0 : this.time * (this.state.boost ? 0.45 : 0.15);
            for (let marker = 0; marker < 11; marker++) {
                const depth = (marker / 11 + movement) % 1;
                const point = this.lanePoint(lane, depth);
                const length = mix(1, 15, depth * depth);
                this.line([[point.x - length, point.y], [point.x, point.y + length * 0.25], [point.x + length, point.y]], selected ? `rgba(241,219,156,${depth * 0.36})` : `rgba(186,214,190,${depth * 0.13})`, mix(0.7, 2, depth));
            }
        }
    }

    drawAir() {
        if (this.reducedMotion || this.state.phase === 'lobby') return;
        const width = this.width;
        const height = this.height;
        const boost = this.state.boost;
        const count = boost ? 26 : 10;
        for (let index = 0; index < count; index++) {
            const progress = (this.time * (boost ? 1.3 : 0.4) + random(index + 217)) % 1;
            const side = index % 2 ? 1 : -1;
            const x = width * 0.5 + side * width * (0.1 + progress * 0.46 + random(index + 16) * 0.25);
            const y = height * (0.29 + progress * 0.7);
            const length = (boost ? 25 : 9) * progress;
            this.line([[x, y], [x + side * length * 0.6, y + length]], `rgba(230,237,221,${progress * (boost ? 0.25 : 0.12)})`, 1);
        }
    }

    drawGates() {
        if (!this.state.answers?.length || !['playing', 'paused'].includes(this.state.phase)) return;
        const width = this.width;
        const height = this.height;
        const context = this.context;
        const progress = this.state.progress;
        const approach = this.reducedMotion ? 0.6 : ease(progress);
        const spread = mix(0.265, 0.305, approach);
        const gateWidth = Math.min(width * mix(0.24, 0.275, approach), mix(150, 218, approach));
        const gateHeight = clamp(height * mix(0.19, 0.24, approach), 100, 185);
        const centerY = height * mix(0.43, 0.56, approach);
        this.state.answers.slice(0, 3).forEach((answer, lane) => {
            const x = width * (0.5 + (lane - 1) * spread);
            const selected = lane === this.state.lane;
            const color = selected ? '#f5d588' : '#a9d2c1';
            const top = centerY - gateHeight * 0.52;
            const bottom = centerY + gateHeight * 0.49;
            const radius = gateWidth * 0.5;
            context.save();
            if (selected) this.glow(x, centerY, gateWidth * 0.85, 'rgba(246,208,119,.18)');
            const portal = context.createLinearGradient(0, top, 0, bottom);
            portal.addColorStop(0, selected ? 'rgba(240,208,130,.09)' : 'rgba(160,223,207,.05)');
            portal.addColorStop(1, 'rgba(13,35,42,.04)');
            context.beginPath();
            context.moveTo(x - radius, bottom);
            context.lineTo(x - radius, top + radius);
            context.bezierCurveTo(x - radius, top - 5, x + radius, top - 5, x + radius, top + radius);
            context.lineTo(x + radius, bottom);
            context.closePath();
            context.fillStyle = portal;
            context.fill();
            context.shadowColor = selected ? '#f8d68b' : '#96c9be';
            context.shadowBlur = selected ? 13 : 5;
            context.strokeStyle = selected ? '#f1cf7e' : 'rgba(184,220,204,.65)';
            context.lineWidth = selected ? 3.5 : 2;
            context.stroke();
            context.shadowBlur = 0;
            context.beginPath();
            context.moveTo(x - radius + 5, bottom - 3);
            context.lineTo(x - radius + 5, top + radius + 2);
            context.bezierCurveTo(x - radius + 5, top + 5, x + radius - 5, top + 5, x + radius - 5, top + radius + 2);
            context.lineTo(x + radius - 5, bottom - 3);
            context.strokeStyle = 'rgba(255,243,202,.25)';
            context.lineWidth = 1;
            context.stroke();
            this.ellipse(x, bottom, radius * 1.08, 7 + approach * 4, 'rgba(18,43,40,.2)', color, selected ? 2 : 1);
            const plateWidth = gateWidth * 0.85;
            const plateHeight = clamp(gateHeight * 0.37, 42, 63);
            const plateY = centerY - plateHeight * 0.45;
            context.fillStyle = selected ? 'rgba(247,231,190,.98)' : 'rgba(16,35,48,.94)';
            context.strokeStyle = selected ? '#fff1c9' : '#a7c5b4';
            context.lineWidth = selected ? 2 : 1;
            context.beginPath();
            context.roundRect(x - plateWidth / 2, plateY, plateWidth, plateHeight, 11);
            context.fill();
            context.stroke();
            const text = typeof answer === 'object' ? answer.value ?? answer.answer ?? answer.label ?? '' : answer;
            const fontSize = Math.min(plateHeight * 0.67, plateWidth / Math.max(2.1, String(text).length * 0.65));
            context.font = `800 ${Math.max(19, fontSize)}px "Nunito", "Trebuchet MS", sans-serif`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillStyle = selected ? '#162a36' : '#f9f1d9';
            context.fillText(String(text), x, plateY + plateHeight * 0.52);
            if (selected) {
                this.path([[x - 6, top - 12], [x, top - 6], [x + 6, top - 12], [x, top - 18]], '#ffe5a1');
                this.line([[x - plateWidth * 0.23, plateY + plateHeight + 7], [x + plateWidth * 0.23, plateY + plateHeight + 7]], 'rgba(252,228,162,.6)', 1.5);
            }
            for (let sparkle = 0; sparkle < 3; sparkle++) {
                const angle = this.time * (this.reducedMotion ? 0 : 0.8) + sparkle * TAU / 3 + lane;
                const sparkleX = x + Math.cos(angle) * radius * 1.05;
                const sparkleY = centerY + Math.sin(angle) * gateHeight * 0.48;
                this.ellipse(sparkleX, sparkleY, selected ? 2 : 1.2, selected ? 2 : 1.2, color);
            }
            context.restore();
        });
    }

    drawWizard() {
        const context = this.context;
        const width = this.width;
        const height = this.height;
        const flying = ['playing', 'reward', 'paused'].includes(this.state.phase);
        const scale = clamp(Math.min(width / 720, height / 560), 0.55, 1.16);
        const laneSpread = width * 0.275;
        const x = width * 0.5 + (this.currentLane - 1) * laneSpread;
        const bob = this.reducedMotion ? 0 : Math.sin(this.time * 3) * 3.5 + Math.cos(this.time * 1.8) * 1.5;
        const landing = clamp((this.time - this.landingStarted) / 0.85, 0, 1);
        const isLanding = this.time - this.landingStarted < 2.5;
        const descent = isLanding ? ease(landing) * height * 0.08 : 0;
        const y = height * (flying ? 0.81 : 0.77) + bob + descent;
        const turn = this.reducedMotion ? 0 : (this.state.lane - this.currentLane) * 0.2 + Math.sin(this.time * 1.9) * 0.018;
        const milestone = this.rewards.find(reward => reward.milestone && this.time - reward.start < 1.5);
        const magicTime = milestone ? this.time - milestone.start : -1;
        const wandRaised = milestone ? Math.sin(clamp(magicTime / 1.5, 0, 1) * Math.PI) : 0;
        const palette = this.palette;
        this.ellipse(x + 10, y + 66 * scale, 70 * scale, 10 * scale, 'rgba(3,23,25,.16)');
        if (isLanding) {
            const cushion = Math.sin(landing * Math.PI) * 0.8 + (1 - landing) * 0.2;
            this.glow(x, y + 60 * scale, 90 * scale, 'rgba(142,226,203,.5)', cushion);
            for (let ring = 0; ring < 3; ring++) this.ellipse(x, y + (50 + ring * 9) * scale, (34 + ring * 17 + landing * 12) * scale, (6 + ring * 3) * scale, null, `rgba(175,238,211,${cushion * 0.55})`, 1.5);
        }
        context.save();
        context.translate(x, y);
        context.scale(scale, scale);
        context.rotate(turn);
        if (this.state.boost && flying) this.drawBoost();
        const wind = this.reducedMotion ? 0 : Math.sin(this.time * (this.state.boost ? 15 : 8)) * (this.state.boost ? 6 : 3);
        this.drawBroom(wind);
        this.path([[-12, 8], [-27, 30], [-23, 49], [-12, 50], [-7, 31], [4, 22]], '#263446', '#57616a', 1);
        this.path([[17, 9], [30, 24], [26, 43], [15, 42], [16, 28], [4, 22]], '#20303f', '#53606a', 1);
        this.path([[-25, 43], [-13, 44], [-8, 55], [-30, 56], [-34, 52]], '#142330', '#758087', 1);
        this.path([[16, 38], [27, 39], [34, 46], [32, 51], [13, 49]], '#142330', '#758087', 1);
        const cloakGradient = context.createLinearGradient(-35, -48, 35, 37);
        cloakGradient.addColorStop(0, palette.dark);
        cloakGradient.addColorStop(0.38, palette.primary);
        cloakGradient.addColorStop(0.8, palette.dark);
        cloakGradient.addColorStop(1, palette.primary);
        context.beginPath();
        context.moveTo(-18, -48);
        context.bezierCurveTo(-31, -32, -23, 7, -45 - wind, 39);
        context.bezierCurveTo(-23, 31 + wind, -4, 48 + wind, 9, 32);
        context.bezierCurveTo(21, 40 - wind, 35, 30 + wind, 44 + wind, 36);
        context.bezierCurveTo(31, 12, 25, -32, 17, -47);
        context.closePath();
        context.fillStyle = cloakGradient;
        context.fill();
        context.strokeStyle = 'rgba(13,24,33,.65)';
        context.lineWidth = 1.4;
        context.stroke();
        this.line([[-18, -42], [-20, -2], [-34 - wind * 0.5, 34]], 'rgba(241,207,132,.25)', 1.5);
        this.line([[6, -39], [8, 2], [18, 31]], 'rgba(12,23,33,.4)', 3);
        this.line([[-6, -33], [-9, 7], [-16, 31]], 'rgba(243,181,142,.12)', 2);
        this.path([[-10, -42], [11, -43], [15, -23], [-11, -22]], '#2a3843');
        this.ellipse(-1, -25, 8, 10, palette.secondary);
        this.path([[-5, -30], [4, -30], [2, -23], [-4, -20]], palette.primary);
        this.line([[-18, -38], [-29, -20], [-11, -7]], palette.primary, 12);
        this.line([[-18, -38], [-29, -20], [-11, -7]], 'rgba(255,224,178,.10)', 2);
        this.ellipse(-9, -6, 5, 6, '#c98f68', '#774f3b', 0.7);
        const armX = mix(32, 36, wandRaised);
        const elbowY = mix(-20, -49, wandRaised);
        const handX = mix(36, 40, wandRaised);
        const handY = mix(-9, -76, wandRaised);
        this.line([[17, -39], [armX, elbowY], [handX, handY]], palette.primary, 12);
        this.line([[armX + 1, elbowY], [handX + 1, handY]], 'rgba(246,222,179,.14)', 1.3);
        this.ellipse(handX, handY, 4.7, 5.5, '#d8a37c', '#855f49', 0.7);
        const wandTipX = handX + 13 + wandRaised * 4;
        const wandTipY = handY - 26 - wandRaised * 9;
        this.line([[handX, handY], [wandTipX, wandTipY]], '#c0a178', 2.8);
        this.line([[handX + 2, handY - 5], [wandTipX, wandTipY]], '#e8cf9a', 0.8);
        if (milestone) {
            const pulse = Math.sin(clamp(magicTime / 0.55, 0, 1) * Math.PI);
            this.glow(wandTipX, wandTipY, 35 + pulse * 38, milestone.variant === 1 ? 'rgba(173,225,255,.8)' : 'rgba(255,229,160,.9)', 0.9);
            this.ellipse(wandTipX, wandTipY, 3.5 + pulse * 3, 3.5 + pulse * 3, '#fffbea');
            this.line([[wandTipX - 11, wandTipY], [wandTipX + 11, wandTipY]], '#fff4ce', 1);
            this.line([[wandTipX, wandTipY - 13], [wandTipX, wandTipY + 13]], '#fff4ce', 1);
        }
        this.ellipse(0, -54, 13, 16, '#b77d59', '#754c37', 1);
        this.path([[-13, -59], [-12, -47], [-8, -42], [-7, -55], [-2, -48], [1, -58], [7, -46], [12, -48], [14, -61]], '#4c302a');
        this.ellipse(0, -66, 27, 6.8, '#182c40', '#778383', 1, -0.06);
        const hatGradient = context.createLinearGradient(-16, -102, 17, -66);
        hatGradient.addColorStop(0, '#31445c');
        hatGradient.addColorStop(0.7, '#1c3148');
        hatGradient.addColorStop(1, '#17283b');
        this.path([[-19, -68], [-13, -84], [-8, -112], [3, -105], [10, -88], [19, -69]], hatGradient, '#526478', 1);
        this.path([[-18, -72], [18, -73], [15, -81], [-15, -80]], palette.primary, palette.secondary, 0.7);
        this.path([[-2, -79], [4, -79], [4, -73], [-2, -73]], palette.secondary);
        this.path([[-13, -42], [-4, -38], [7, -41], [11, -36], [-2, -29], [-13, -34]], palette.primary, palette.secondary, 0.8);
        this.path([[-13, -35], [-20 - wind, -13], [-34 - wind * 2, -12], [-30 - wind, -22]], palette.primary, palette.secondary, 0.8);
        context.restore();
    }

    drawBroom(wind) {
        const context = this.context;
        context.save();
        context.rotate(-0.19);
        this.line([[-67, 22], [79, -11], [94, -22]], '#422c22', 8);
        this.line([[-67, 20], [79, -13], [93, -23]], '#a27b4b', 4);
        this.line([[-55, 19], [77, -11]], '#c5a66c', 1);
        const bristles = context.createLinearGradient(-108, 28, -49, 21);
        bristles.addColorStop(0, '#51412e');
        bristles.addColorStop(0.6, '#a17d3e');
        bristles.addColorStop(1, '#e0bd73');
        this.path([[-53, 12], [-88, 9 - wind * 0.3], [-116, 16 + wind], [-111, 23], [-121, 31 + wind], [-113, 37], [-117, 44 + wind * 0.7], [-87, 44], [-49, 28]], bristles, '#c09a53', 0.8);
        for (let index = 0; index < 10; index++) {
            const y = 14 + index * 2.7;
            this.line([[-51, 17 + index], [-85, y], [-112 - random(index + 57) * 7, y + wind * (index / 10)]], index % 3 ? 'rgba(234,201,124,.5)' : 'rgba(60,46,31,.55)', 0.8);
        }
        this.line([[-57, 13], [-52, 29]], '#263a3a', 6);
        this.line([[-58, 13], [-53, 29]], '#d4c183', 1.4);
        this.line([[-64, 13], [-59, 31]], '#d4c183', 1.4);
        context.restore();
    }

    drawBoost() {
        const context = this.context;
        this.glow(-94, 43, 105, 'rgba(255,210,106,.4)');
        context.save();
        context.globalCompositeOperation = 'screen';
        for (let trail = 0; trail < 7; trail++) {
            const offset = trail - 3;
            context.beginPath();
            context.moveTo(-82, 29 + offset * 3);
            context.bezierCurveTo(-132, 26 + offset * 4, -115, 91 + offset * 7, -169 - trail * 9, 101 + offset * 5);
            context.strokeStyle = `rgba(255,${201 + trail * 5},${111 + trail * 11},${0.3 - Math.abs(offset) * 0.045})`;
            context.lineWidth = 5 - Math.abs(offset);
            context.stroke();
        }
        if (!this.reducedMotion) {
            for (let particle = 0; particle < 15; particle++) {
                const progress = (this.time * 1.7 + particle / 15) % 1;
                this.ellipse(-85 - progress * 110 + Math.sin(particle) * 18, 30 + progress * 105 + Math.sin(progress * 9 + particle) * 7, (1 - progress) * 2, (1 - progress) * 2, `rgba(255,226,142,${1 - progress})`);
            }
        }
        context.restore();
    }

    drawRewards() {
        for (const reward of this.rewards) {
            const elapsed = this.time - reward.start;
            if (elapsed < 1.1) this.drawSnitch(reward, elapsed);
            if (reward.milestone && elapsed < 1.5) this.drawMagic(reward, elapsed);
        }
    }

    snitchPosition(reward, progress) {
        const direction = reward.direction;
        const curve = Math.sin(progress * Math.PI);
        return {
            x: this.width * (direction === 1 ? mix(-0.08, 1.08, progress) : mix(1.08, -0.08, progress)),
            y: this.height * (0.38 - curve * 0.16 + Math.sin(progress * TAU + reward.seed) * 0.045)
        };
    }

    drawSnitch(reward, elapsed) {
        const context = this.context;
        const progress = elapsed / 1.1;
        const opacity = clamp(Math.min(elapsed * 9, (1.1 - elapsed) * 8), 0, 1);
        const position = this.reducedMotion ? { x: this.width * 0.74, y: this.height * 0.29 } : this.snitchPosition(reward, progress);
        const scale = clamp(this.width / 950, 0.68, 1.1);
        context.save();
        context.globalAlpha = opacity;
        if (!this.reducedMotion) {
            for (let particle = 0; particle < 25; particle++) {
                const trailProgress = progress - particle * 0.008;
                if (trailProgress < 0) continue;
                const trail = this.snitchPosition(reward, trailProgress);
                const scatter = particle * 0.65;
                this.ellipse(trail.x + Math.sin(particle * 5.3) * scatter, trail.y + Math.cos(particle * 3.7) * scatter, (1 - particle / 25) * 2.3, (1 - particle / 25) * 2.3, `rgba(255,219,118,${opacity * (1 - particle / 25) * 0.8})`);
            }
        }
        context.translate(position.x, position.y);
        context.scale(scale * reward.direction, scale);
        context.rotate(this.reducedMotion ? 0 : Math.sin(progress * 9 + reward.seed) * 0.2);
        this.glow(0, 0, 42, 'rgba(255,220,118,.36)', opacity);
        const wingbeat = this.reducedMotion ? 0.7 : 0.25 + Math.abs(Math.sin(this.time * 61)) * 0.85;
        [-1, 1].forEach(side => {
            context.save();
            context.scale(side, wingbeat);
            context.beginPath();
            context.moveTo(4, -2);
            context.bezierCurveTo(15, -27, 32, -21, 42, -13);
            context.bezierCurveTo(27, -15, 25, -2, 7, 4);
            context.closePath();
            context.fillStyle = '#f3e8bd';
            context.strokeStyle = '#ceb57f';
            context.lineWidth = 0.8;
            context.fill();
            context.stroke();
            for (let feather = 0; feather < 5; feather++) this.line([[7, 1], [18 + feather * 4.3, -16 - Math.sin(feather) * 4]], 'rgba(155,133,88,.55)', 0.75);
            context.restore();
        });
        const gold = context.createRadialGradient(-4, -4, 1, 1, 1, 11);
        gold.addColorStop(0, '#fff2b4');
        gold.addColorStop(0.35, '#e9c16a');
        gold.addColorStop(0.8, '#b7862e');
        gold.addColorStop(1, '#6b4d20');
        this.ellipse(0, 0, 10, 10, gold, '#f5d787', 1);
        this.ellipse(-1, 0, 5, 8, null, 'rgba(106,72,25,.45)', 0.8, 0.4);
        this.line([[-8, -3], [1, -5], [8, -1]], 'rgba(255,234,155,.6)', 1);
        this.ellipse(-4, -4, 2.4, 2.4, '#fff5ce');
        context.restore();
    }

    drawMagic(reward, elapsed) {
        const context = this.context;
        const progress = elapsed / 1.5;
        const opacity = Math.sin(progress * Math.PI);
        const x = this.width * (0.5 + (this.currentLane - 1) * 0.275);
        const y = this.height * 0.43;
        const size = Math.min(this.width * 0.23, this.height * 0.26, 175);
        context.save();
        context.globalCompositeOperation = 'screen';
        if (this.reducedMotion) {
            this.glow(x, y, size * 1.1, reward.variant === 1 ? 'rgba(134,208,255,.45)' : 'rgba(255,223,142,.45)', opacity);
            this.ellipse(x, y, size * 0.54, size * 0.54, null, `rgba(245,231,185,${opacity})`, 2);
            this.star(x, y, 16, `rgba(255,241,196,${opacity})`);
        } else if (reward.variant === 0) {
            this.glow(x, y, size * 1.4, 'rgba(255,205,105,.23)', opacity);
            for (let arm = 0; arm < 3; arm++) {
                context.beginPath();
                for (let point = 0; point < 58; point++) {
                    const fraction = point / 58;
                    const angle = fraction * Math.PI * 3.1 + elapsed * 4 + arm * TAU / 3;
                    const radius = size * fraction * Math.sin(progress * Math.PI * 0.82);
                    const pointX = x + Math.cos(angle) * radius;
                    const pointY = y + Math.sin(angle) * radius * 0.7;
                    point ? context.lineTo(pointX, pointY) : context.moveTo(pointX, pointY);
                }
                context.strokeStyle = `rgba(255,220,135,${opacity * 0.8})`;
                context.lineWidth = 2.5;
                context.stroke();
            }
            this.drawMagicParticles(x, y, size, elapsed, opacity, '#ffe1a0');
        } else if (reward.variant === 1) {
            this.glow(x, y, size * 1.35, 'rgba(94,186,251,.29)', opacity);
            for (let ring = 0; ring < 3; ring++) {
                const radius = size * (0.35 + progress * 0.65) + ring * 9;
                this.ellipse(x, y, radius, radius * (ring === 1 ? 0.5 : 0.82), null, `rgba(${ring === 1 ? '214,240,255' : '129,204,255'},${opacity * (0.9 - ring * 0.2)})`, ring === 0 ? 3 : 1.3, ring === 1 ? elapsed : -elapsed * 0.4);
                for (let symbol = 0; symbol < 10; symbol++) {
                    const angle = symbol * TAU / 10 + elapsed * 0.8;
                    this.star(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * 0.82, 2.5, `rgba(193,231,255,${opacity})`);
                }
            }
            this.drawMagicParticles(x, y, size, elapsed, opacity, '#c2eaff');
        } else {
            this.glow(x, y, size * 1.25, 'rgba(175,221,249,.27)', opacity);
            this.drawStag(x, y, size / 100, elapsed, opacity);
            this.drawMagicParticles(x, y, size, elapsed, opacity, '#edf9ff');
        }
        context.restore();
    }

    star(x, y, radius, color) {
        this.path([[x, y - radius * 1.6], [x + radius * 0.3, y - radius * 0.3], [x + radius, y], [x + radius * 0.3, y + radius * 0.3], [x, y + radius * 1.6], [x - radius * 0.3, y + radius * 0.3], [x - radius, y], [x - radius * 0.3, y - radius * 0.3]], color);
    }

    drawMagicParticles(x, y, size, elapsed, opacity, color) {
        for (let particle = 0; particle < 32; particle++) {
            const angle = particle * 2.399 + elapsed * 0.7;
            const radius = size * Math.sqrt(particle / 32) * (0.4 + elapsed * 0.7);
            const pointX = x + Math.cos(angle) * radius;
            const pointY = y + Math.sin(angle) * radius * 0.75;
            this.context.globalAlpha = opacity * (0.5 + random(particle + 3) * 0.5);
            if (particle % 5 === 0) this.star(pointX, pointY, 2.5 + Math.sin(elapsed * 8 + particle), color);
            else this.ellipse(pointX, pointY, 1 + particle % 2, 1 + particle % 2, color);
        }
        this.context.globalAlpha = 1;
    }

    drawStag(x, y, scale, elapsed, opacity) {
        const context = this.context;
        const stride = Math.sin(elapsed * 9) * 8;
        context.save();
        context.translate(x, y);
        context.scale(scale, scale);
        context.globalAlpha = opacity;
        context.shadowColor = '#b9e6ff';
        context.shadowBlur = 17;
        const silver = 'rgba(224,245,255,.92)';
        this.path([[-50, 0], [-31, -13], [13, -13], [30, -42], [38, -48], [51, -44], [58, -37], [47, -29], [39, -29], [31, -6], [20, 8], [-26, 11]], 'rgba(182,227,250,.16)', silver, 2);
        this.line([[-43, 7], [-36 + stride, 32], [-51 + stride, 53]], silver, 2.7);
        this.line([[-26, 10], [-14 - stride, 33], [-21 - stride, 53]], silver, 2.7);
        this.line([[13, 8], [25 - stride, 29], [20 - stride, 52]], silver, 2.7);
        this.line([[24, 2], [43 + stride, 24], [38 + stride, 46]], silver, 2.7);
        this.line([[-49, -1], [-63, -11], [-59, -3]], silver, 2);
        this.line([[36, -46], [26, -60], [20, -85], [14, -95]], silver, 2.2);
        this.line([[26, -60], [12, -67], [3, -80]], silver, 1.6);
        this.line([[21, -78], [29, -89], [28, -99]], silver, 1.6);
        this.line([[44, -47], [47, -67], [56, -84], [53, -97]], silver, 2.2);
        this.line([[47, -67], [61, -71], [68, -83]], silver, 1.6);
        this.line([[54, -82], [44, -88], [39, -99]], silver, 1.6);
        this.path([[35, -46], [31, -56], [40, -51]], 'rgba(221,247,255,.6)', silver, 1);
        this.ellipse(48, -40, 1.8, 1.8, '#fff');
        this.line([[-34, -3], [-5, 2], [22, -5]], 'rgba(224,245,255,.35)', 1);
        context.restore();
    }
}
