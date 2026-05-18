const scrollContainer = document.querySelector('.scroll-container');
const otter = document.getElementById('otter');
const textLayer = document.getElementById('textLayer');
const aboutMe = document.getElementById('aboutMe');
const aboutTitle = document.getElementById('aboutTitle');
const aboutIntro = document.getElementById('aboutIntro');
const fountain = document.getElementById('fountain');
const portfolioCard = document.getElementById('portfolioCard');

document.getElementById('navAbout').addEventListener('click', (e) => {
    e.preventDefault();
    const totalH = scrollContainer.clientHeight - window.innerHeight;
    window.scrollTo({ top: totalH * 0.5, behavior: 'smooth' });
});

document.getElementById('navNotebook').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('notebookSection').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('navResearch').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('researchSection').scrollIntoView({ behavior: 'smooth' });
});

window.addEventListener('scroll', () => {
    const offsetTop = scrollContainer.offsetTop;
    const totalScrollableHeight = scrollContainer.clientHeight - window.innerHeight;
    const rawProgress = (window.scrollY - offsetTop) / totalScrollableHeight;
    let progress = Math.max(0, Math.min(1, rawProgress));

    // 首屏文字向右滑出
    const phaseOne = Math.min(progress / 0.28, 1);
    textLayer.style.transform = `translateX(${phaseOne * window.innerWidth * 0.9}px)`;
    textLayer.style.opacity = 1 - phaseOne * 1.15;

    // 水獭向左移动
    const otterTravel = window.innerWidth + otter.offsetWidth * 1.35;
    const otterCurrentX = -Math.min(progress * 1.75, 1) * otterTravel;
    otter.style.transform = `translateX(${otterCurrentX}px)`;

    // About Me 标题：从最右侧外，与水獭同速同向滑入，固定距离一起向左
    const aboutStartX = window.innerWidth * 1.15;
    const aboutTitleX = Math.max(0, otterCurrentX + aboutStartX);
    aboutTitle.style.transform = `translateX(${aboutTitleX}px)`;

    // About Me 容器：始终不透明（一旦滚动），无渐隐效果
    aboutMe.style.opacity = 1;

    // 喷泉：升起 → 保持 → Portfolio 卡片快要消失（lift 末段）时向右滑出
    const fInStart = 0.13, fInEnd = 0.30;
    const fSlideStart = 1.10; // 等 Notebook 已经出现在视口里再开始撤
    const fSlideEnd   = 1.30; // Notebook 接近完全可见时滑出完成
    let fountainOpacity = 0;
    let fountainYPercent = 100;
    let fountainXPercent = 0;

    if (rawProgress < fInStart) {
        // 隐藏在下方
    } else if (rawProgress < fInEnd) {
        const fInP = (rawProgress - fInStart) / (fInEnd - fInStart);
        const easeOut = 1 - Math.pow(1 - fInP, 3);
        fountainOpacity = fInP;
        fountainYPercent = (1 - easeOut) * 100;
    } else if (rawProgress < fSlideStart) {
        // 保持位置（即便 About Me 在向上抬起，喷泉也不动）
        fountainOpacity = 1;
        fountainYPercent = 0;
    } else if (rawProgress < fSlideEnd) {
        fountainOpacity = 1;
        fountainYPercent = 0;
        const fOutP = (rawProgress - fSlideStart) / (fSlideEnd - fSlideStart);
        const easeIn = Math.pow(fOutP, 2);
        fountainXPercent = easeIn * 220; // 向右滑出
    } else {
        fountainOpacity = 0;
        fountainXPercent = 220;
    }

    fountain.style.opacity = fountainOpacity;
    fountain.style.transform = `translateX(${fountainXPercent}%) translateY(${fountainYPercent}%)`;

    // About Me 介绍 + Portfolio 卡片：标题在 ~0.25 就位之后再从视口下方升起
    const riseStart = 0.32, riseEnd = 0.68;
    const riseP = Math.max(0, Math.min(1, (progress - riseStart) / (riseEnd - riseStart)));
    const riseEase = 1 - Math.pow(1 - riseP, 3);
    const riseInitialY = window.innerHeight * 0.9; // 起点：自然位置下方约 90vh（视口外）
    const riseTranslateY = (1 - riseEase) * riseInitialY;
    aboutIntro.style.opacity = 1;
    aboutIntro.style.transform = `translateY(${riseTranslateY}px)`;
    if (portfolioCard) {
        portfolioCard.style.opacity = 1;
        portfolioCard.style.transform = `translateY(${riseTranslateY}px)`;
    }

    // 整个 About Me（标题 + intro + 卡片）一起向上滑出视口；不渐隐
    const liftStart = 0.75;
    const liftP = Math.max(0, Math.min(1, (progress - liftStart) / (1 - liftStart)));
    const liftEase = Math.pow(liftP, 2);
    aboutMe.style.transform = `translateY(${-liftEase * window.innerHeight * 1.4}px)`;
});

// Mindmap：从外部 .md 文件加载并用 markmap 渲染
let currentMarkmap = null;
let currentMmRoot = null;
let currentInitialExpandLevel = 2;
let mindmapLoadToken = 0;
let mindmapSearchTimer = null;

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
        const res = await fetch(mdPath);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const md = await res.text();
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
    document.body.style.overflow = 'auto';
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
    document.body.style.overflow = 'auto';
}
