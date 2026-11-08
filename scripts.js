const scrollContainer = document.querySelector('.scroll-container');
const otter = document.getElementById('otter');
const textLayer = document.getElementById('textLayer');
const aboutMe = document.getElementById('aboutMe');
const aboutTitle = document.getElementById('aboutTitle');
const aboutIntro = document.getElementById('aboutIntro');
const aboutPhoto = document.querySelector('.about-photo');
const fountain = document.getElementById('fountain');
const portfolioCard = document.getElementById('portfolioCard');

const aboutRiseEnd = 0.68;
const fountainExitStart = 1.10;
const fountainExitEnd = 1.30;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let sceneTop;
let sceneTravel;
let sceneWidth;
let sceneHeight;
let otterTravel;
let sceneFrame = null;
let lastProgress;

document.getElementById('navAbout').addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({
        top: sceneTop + sceneTravel * aboutRiseEnd,
        behavior: reduceMotion.matches ? 'instant' : 'smooth',
    });
});

for (const [linkId, sectionId] of [
    ['navResearch', 'researchSection'],
    ['navNotebook', 'notebookSection'],
]) {
    document.getElementById(linkId).addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById(sectionId).scrollIntoView({
            behavior: reduceMotion.matches ? 'instant' : 'smooth',
        });
    });
}

function scheduleSceneFrame() {
    if (sceneFrame === null) sceneFrame = requestAnimationFrame(renderScene);
}

function measureScene() {
    sceneWidth = window.innerWidth;
    sceneHeight = window.innerHeight;
    sceneTop = scrollContainer.getBoundingClientRect().top + window.scrollY;
    sceneTravel = Math.max(1, scrollContainer.clientHeight - sceneHeight);
    otterTravel = sceneWidth + otter.offsetWidth * 1.35;
    lastProgress = undefined;
    scheduleSceneFrame();
}

function renderScene() {
    sceneFrame = null;
    const rawProgress = Math.max(0, Math.min(fountainExitEnd, (window.scrollY - sceneTop) / sceneTravel));
    if (rawProgress === lastProgress) return;
    lastProgress = rawProgress;
    const progress = Math.min(1, rawProgress);

    // 首屏文字向右滑出，水獭向左游动，About Me 标题跟在水獭后面。
    const phaseOne = Math.min(progress / 0.28, 1);
    textLayer.style.transform = `translateX(${phaseOne * sceneWidth * 0.9}px)`;
    textLayer.style.opacity = 1 - phaseOne;

    const otterCurrentX = -Math.min(progress * 1.75, 1) * otterTravel;
    otter.style.transform = `translateX(${otterCurrentX}px)`;

    const aboutTitleX = Math.max(0, otterCurrentX + sceneWidth * 1.15);
    aboutTitle.style.transform = `translateX(${aboutTitleX}px)`;

    // 喷泉升起，保持到 Research 进入视口后再向右滑出。
    const fountainRise = Math.max(0, Math.min(1, (rawProgress - 0.13) / (0.30 - 0.13)));
    const fountainY = Math.pow(1 - fountainRise, 3) * 100;
    const fountainExit = Math.max(0, (rawProgress - fountainExitStart) / (fountainExitEnd - fountainExitStart));
    const fountainX = Math.pow(fountainExit, 2) * 220;
    fountain.style.opacity = rawProgress < fountainExitEnd ? fountainRise : 0;
    fountain.style.transform = `translate(${fountainX}%, ${fountainY}%)`;

    // About Me 的照片和介绍升起，随后整个区域向上离开。
    const riseStart = 0.32;
    const riseP = Math.max(0, Math.min(1, (progress - riseStart) / (aboutRiseEnd - riseStart)));
    const riseEase = 1 - Math.pow(1 - riseP, 3);
    aboutIntro.style.transform = `translateY(${(1 - riseEase) * sceneHeight * 0.9}px)`;
    aboutPhoto.style.opacity = riseEase;
    aboutPhoto.style.setProperty('--photo-rise', `${(1 - riseEase) * sceneHeight * 0.18}px`);

    const liftStart = 0.75;
    const liftP = Math.max(0, (progress - liftStart) / (1 - liftStart));
    aboutMe.style.opacity = progress > 0 ? 1 : 0;
    aboutMe.style.transform = `translateY(${-Math.pow(liftP, 2) * sceneHeight * 1.4}px)`;
}

window.addEventListener('scroll', scheduleSceneFrame, { passive: true });
window.addEventListener('resize', measureScene);
window.addEventListener('pageshow', scheduleSceneFrame);
measureScene();

// Mindmap：从外部 .md 文件加载并用 markmap 渲染
let currentMarkmap = null;
let currentMmRoot = null;
let currentInitialExpandLevel = 2;
let mindmapLoadToken = 0;
let mindmapSearchTimer = null;
let mindmapLibrary;

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => {
            script.remove();
            reject(new Error('Could not load a Notebook resource'));
        };
        document.head.appendChild(script);
    });
}

function loadMindmapLibrary() {
    if (!mindmapLibrary) {
        mindmapLibrary = loadScript('https://cdn.jsdelivr.net/npm/markmap-autoloader@0.18.12')
            .then(() => window.markmap.autoLoader.ready)
            .catch((error) => {
                mindmapLibrary = undefined;
                throw error;
            });
    }
    return mindmapLibrary;
}

async function loadNotebookMarkdown(mdPath) {
    try {
        const response = await fetch(mdPath);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.text();
    } catch (error) {
        if (!window.NOTEBOOK_NOTES) await loadScript('./notes/intro-to-hci-data.js');
        const markdown = window.NOTEBOOK_NOTES?.[mdPath];
        if (!markdown) throw error;
        return markdown;
    }
}

async function openMindmap(mdPath) {
    const modal = document.getElementById('mindmapModal');
    const svg = document.getElementById('markmapSvg');
    const searchInput = document.getElementById('mindmapSearch');
    if (searchInput) searchInput.value = '';

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    svg.innerHTML = '';
    if (currentMarkmap) {
        currentMarkmap.destroy && currentMarkmap.destroy();
        currentMarkmap = null;
        currentMmRoot = null;
    }

    const myToken = ++mindmapLoadToken;
    try {
        const [md] = await Promise.all([loadNotebookMarkdown(mdPath), loadMindmapLibrary()]);
        if (myToken !== mindmapLoadToken) return;

        if (!window.markmap || !window.markmap.Transformer || !window.markmap.Markmap) {
            throw new Error('markmap library not loaded');
        }
        const transformer = new window.markmap.Transformer();
        const { root, features, frontmatter } = transformer.transform(md);
        if (window.markmap.loadCSS && features.styles) window.markmap.loadCSS(features.styles);
        if (window.markmap.loadJS && features.scripts) window.markmap.loadJS(features.scripts);

        // 应用 frontmatter 选项（color 调色板 + initialExpandLevel）
        let derivedOptions = {};
        if (window.markmap.deriveOptions) {
            derivedOptions = window.markmap.deriveOptions(frontmatter && frontmatter.markmap) || {};
        } else if (frontmatter && frontmatter.markmap && Array.isArray(frontmatter.markmap.color)) {
            const palette = frontmatter.markmap.color;
            derivedOptions.color = (node) => {
                let n = node;
                while (n.parent && n.parent.parent) n = n.parent;
                const idx = n.parent ? n.parent.children.indexOf(n) : 0;
                return palette[idx % palette.length];
            };
        }
        // 默认折叠层级（如果 frontmatter 没指定）
        const explicitLevel = frontmatter && frontmatter.markmap && frontmatter.markmap.initialExpandLevel;
        currentInitialExpandLevel = typeof explicitLevel === 'number' ? explicitLevel : 2;
        const options = { initialExpandLevel: currentInitialExpandLevel, ...derivedOptions };

        currentMmRoot = root;
        currentMarkmap = window.markmap.Markmap.create(svg, options, root);
    } catch (err) {
        console.error('Mindmap load error:', err);
        if (myToken === mindmapLoadToken) {
            svg.outerHTML = `<div id="markmapSvg" style="color: var(--color-accent); font-family: 'IM Fell English', serif; font-size: 1.4rem; text-align: center; padding-top: 30vh;">Could not load note (${err.message})</div>`;
        }
    }
}

function closeMindmap() {
    mindmapLoadToken++;
    document.getElementById('mindmapModal').classList.remove('active');
    document.body.style.overflow = '';
    const searchInput = document.getElementById('mindmapSearch');
    if (searchInput) searchInput.value = '';
    const svgEl = document.getElementById('markmapSvg');
    if (svgEl && svgEl.tagName !== 'svg' && svgEl.tagName !== 'SVG') {
        svgEl.outerHTML = '<svg id="markmapSvg" style="width:100%;height:100%"></svg>';
    }
    currentMmRoot = null;
}

// ===== mindmap 搜索 =====
function handleMindmapSearch(query) {
    clearTimeout(mindmapSearchTimer);
    mindmapSearchTimer = setTimeout(() => applyMindmapSearch(query), 180);
}

async function applyMindmapSearch(query) {
    if (!currentMarkmap || !currentMmRoot) return;
    const q = (query || '').toLowerCase().trim();

    if (!q) {
        // 还原默认折叠层级
        applyFold(currentMmRoot, (depth) => depth >= currentInitialExpandLevel, 0);
    } else {
        // 标记匹配节点，展开包含匹配的路径
        markMatches(currentMmRoot, q);
        applyFold(currentMmRoot, (depth, node) => !node._hasMatch, 0);
    }

    await currentMarkmap.setData(currentMmRoot);
    currentMarkmap.fit && currentMarkmap.fit();
    requestAnimationFrame(() => highlightMatches(q));
}

function markMatches(node, query) {
    const text = (node.content || '').toLowerCase();
    let hasMatch = text.includes(query);
    node._isMatch = hasMatch;
    if (node.children) {
        for (const child of node.children) {
            if (markMatches(child, query)) hasMatch = true;
        }
    }
    node._hasMatch = hasMatch;
    return hasMatch;
}

function applyFold(node, shouldFoldFn, depth) {
    if (!node.payload) node.payload = {};
    if (depth === 0) {
        node.payload.fold = 0; // 根节点永不折叠
    } else {
        node.payload.fold = shouldFoldFn(depth, node) ? 1 : 0;
    }
    if (node.children) {
        for (const child of node.children) {
            applyFold(child, shouldFoldFn, depth + 1);
        }
    }
}

function highlightMatches(query) {
    const svg = document.getElementById('markmapSvg');
    if (!svg) return;
    const allNodes = svg.querySelectorAll('g.markmap-node');
    allNodes.forEach(g => {
        const text = (g.textContent || '').toLowerCase();
        if (query && text.includes(query)) {
            g.classList.add('search-match');
        } else {
            g.classList.remove('search-match');
        }
    });
}

// 探照灯效果：通用 — 鼠标移动时，圆形揭示卡片内的 .spotlight-layer 背景图
function attachSpotlight(card) {
    if (!card) return;
    const spotlight = card.querySelector('.spotlight-layer');
    if (!spotlight) return;
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        spotlight.style.setProperty('--x', `${e.clientX - rect.left}px`);
        spotlight.style.setProperty('--y', `${e.clientY - rect.top}px`);
    });
}
attachSpotlight(portfolioCard);
attachSpotlight(document.getElementById('hciCard'));

// Research 卡片：保留鼠标探照灯，并在点击后只展开当前论文的右侧光束。
const researchCards = document.querySelectorAll('.research-card');

function closeResearchBeams() {
    document.querySelectorAll('.research-row.active').forEach((row) => {
        row.classList.remove('active');
        const card = row.querySelector('.research-card');
        const details = row.querySelector('.beam-details');
        if (card) card.setAttribute('aria-expanded', 'false');
        if (details) details.setAttribute('aria-hidden', 'true');
    });
}

researchCards.forEach((card) => {
    attachSpotlight(card);
    card.addEventListener('click', (event) => {
        event.stopPropagation();
        const row = card.closest('.research-row');
        const shouldOpen = !row.classList.contains('active');
        closeResearchBeams();
        if (shouldOpen) {
            row.classList.add('active');
            card.setAttribute('aria-expanded', 'true');
            row.querySelector('.beam-details')?.setAttribute('aria-hidden', 'false');
        }
    });
});

document.addEventListener('click', (event) => {
    if (!event.target.closest('.research-row')) closeResearchBeams();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeResearchBeams();
});

// Portfolio 弹窗 —— 把已转好的图片每页竖向堆叠
const PORTFOLIO_PAGE_COUNT = 6;
const PORTFOLIO_IMAGE_PREFIX = './images/portfolio_pages-to-jpg-';
const PORTFOLIO_IMAGE_EXT = '.jpg';

function openPdf() {
    const modal = document.getElementById('pdfModal');
    const container = document.getElementById('pdfPagesContainer');
    container.innerHTML = '';
    for (let i = 1; i <= PORTFOLIO_PAGE_COUNT; i++) {
        const num = String(i).padStart(4, '0');
        const img = document.createElement('img');
        img.src = `${PORTFOLIO_IMAGE_PREFIX}${num}${PORTFOLIO_IMAGE_EXT}`;
        img.alt = `Portfolio page ${i}`;
        img.className = 'pdf-page';
        img.loading = i === 1 ? 'eager' : 'lazy';
        container.appendChild(img);
    }
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePdf() {
    document.getElementById('pdfModal').classList.remove('active');
    document.getElementById('pdfPagesContainer').innerHTML = '';
    document.body.style.overflow = '';
}
