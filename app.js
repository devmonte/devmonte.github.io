// App Initialization & State
const GITHUB_ARTICLES_API = 'https://api.github.com/repos/devmonte/blog-articles/contents/articles?ref=master';
const RAW_ARTICLE_BASE = 'https://raw.githubusercontent.com/devmonte/blog-articles/master/articles/';
const RAW_REPO_BASE = 'https://raw.githubusercontent.com/devmonte/blog-articles/master/';

const FALLBACK_ARTICLES = [
  'git-branching-strategy.md',
  'scrum-training.md'
];

const LOCAL_DEMO_POSTS = [
  {
    id: 'git-branching-strategy',
    title: 'Git Branching Strategy for Small & Fast-Moving Teams',
    date: '2026-08-01',
    description: 'A pragmatic approach to Trunk-Based Development and Feature Flags to ship code faster with fewer merge conflicts.',
    tags: '#git #devops #engineering',
    published: true,
    readTime: '4 min read',
    body: `---
title: "Git Branching Strategy for Small & Fast-Moving Teams"
date: "2026-08-01"
tags: "#git #devops #engineering"
---

# Git Branching Strategy for Small & Fast-Moving Teams

Shipping code reliably requires a clear, low-friction Git workflow. While **GitFlow** worked well in the era of scheduled release cycles, modern continuous deployment favors **Trunk-Based Development**.

## Why Traditional GitFlow Slows Teams Down

1. **Long-lived feature branches**: Merging after weeks leads to complex merge conflicts.
2. **Delayed feedback**: Code integration happens late in the release cycle.
3. **Environment drift**: Staging and production drift apart.

\`\`\`bash
# Keep feature branches short-lived
git checkout -b feature/fast-feedback
git commit -m "Implement feature behind flag"
git push origin feature/fast-feedback
\`\`\`

## Recommended Best Practices

- **Short-Lived Branches**: Keep branches alive for no more than 1–2 days.
- **Feature Flags**: Wrap incomplete features in runtime flags instead of keeping unmerged code.
- **Automated CI/CD**: Run linting, unit tests, and build checks automatically on every pull request.
`
  },
  {
    id: 'scrum-training',
    title: 'Lessons Learned from Agile & Scrum Team Coaching',
    date: '2026-07-15',
    description: 'Key takeaways on velocity, team autonomy, and removing sprint blockers without process overhead.',
    tags: '#agile #scrum #management',
    published: true,
    readTime: '3 min read',
    body: `---
title: "Lessons Learned from Agile & Scrum Team Coaching"
date: "2026-07-15"
tags: "#agile #scrum #management"
---

# Lessons Learned from Agile & Scrum Team Coaching

Agile methodologies are meant to serve the team, not the other way around. Overly rigid processes create friction and reduce developer autonomy.

## Core Principles That Matter Most

> "Individuals and interactions over processes and tools."

### 1. Daily Standups should be concise
Keep standups under 15 minutes. Focus strictly on blockers and alignment for the current day.

### 2. Retrospectives must lead to actionable items
Limit retro outcomes to 1 or 2 concrete improvements per sprint rather than a long list of unresolved complaints.
`
  }
];

let postsData = [];
let activeTagFilter = 'ALL';
let searchQuery = '';
let currentOpenedPost = null;

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initTitleRotator();
  initSearchAndFilter();
  initReadingProgress();
  initHashRouting();
  loadBlogPosts();
});

function navigateToRoute(route) {
  window.location.hash = route;
  checkHashRoute();
}

/* -------------------------------------------------------------
 * 1. Light / Dark Theme Management
 * ------------------------------------------------------------- */
function initThemeToggle() {
  const themeBtn = document.getElementById('theme-toggle');
  if (!themeBtn) return;

  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');

  setTheme(currentTheme);

  themeBtn.addEventListener('click', () => {
    const activeTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = activeTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  });
}

let leafletMapInstance = null;
let leafletTileLayer = null;

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const themeIcon = document.querySelector('#theme-toggle i');
  if (themeIcon) {
    themeIcon.className = theme === 'dark' ? 'far fa-sun' : 'far fa-moon';
  }
  updateMapTileTheme();
}

/* -------------------------------------------------------------
 * 2. Hero Title Rotator
 * ------------------------------------------------------------- */
function initTitleRotator() {
  const titleElement = document.getElementById('title');
  if (!titleElement) return;

  const titles = [
    'engineer', 'traveller', 'bushcrafter', 'mountaineer', 
    'photographer', 'cyclist', 'runner', 'hiker', 
    'reader', 'learner', 'minimalist', 'doer'
  ];
  let index = 0;

  setInterval(() => {
    // 1. Smoothly fade out current title upwards
    titleElement.classList.add('fade-out');

    setTimeout(() => {
      // 2. Advance to next word while element is invisible
      index = (index + 1) % titles.length;
      titleElement.textContent = titles[index];

      // 3. Position invisible element slightly below
      titleElement.classList.remove('fade-out');
      titleElement.classList.add('fade-in-prepare');
      void titleElement.offsetWidth; // Force reflow

      // 4. Smoothly transition element into place
      titleElement.classList.remove('fade-in-prepare');
    }, 320);
  }, 2400);
}

/* -------------------------------------------------------------
 * 3. YAML Frontmatter Parser
 * ------------------------------------------------------------- */
function parseYAMLFrontmatter(text, fileName) {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = text.match(frontmatterRegex);

  const id = fileName.replace(/\.md$/, '');

  let yamlBlock = '';
  let body = text;

  if (match) {
    yamlBlock = match[1];
    body = match[2];
  }

  const metadata = {
    id,
    title: id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    date: '',
    description: '',
    tags: '',
    published: true,
    cover_image: '',
    readTime: '1 min read',
    body: body
  };

  if (yamlBlock) {
    yamlBlock.split('\n').forEach(line => {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim();
        let value = line.slice(colonIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (key === 'published') {
          metadata.published = value !== 'false';
        } else if (value) {
          metadata[key] = value;
        }
      }
    });
  }

  // Calculate reading time based on word count
  const words = body.trim().split(/\s+/).filter(w => w.length > 0).length;
  metadata.readTime = `${Math.max(1, Math.ceil(words / 200))} min read`;

  // Fix relative image links in markdown body:
  metadata.body = body
    .replace(/!\[(.*?)\]\(\.\.\/(.*?)\)/g, (m, p1, p2) => `![${p1}](${RAW_REPO_BASE}${p2})`)
    .replace(/!\[(.*?)\]\(\/(.*?)\)/g, (m, p1, p2) => `![${p1}](${RAW_REPO_BASE}${p2})`);

  return metadata;
}

/* -------------------------------------------------------------
 * 4. Load & Render Blog Posts from devmonte/blog-articles
 * ------------------------------------------------------------- */
async function loadBlogPosts() {
  const postsListContainer = document.getElementById('posts-list');
  if (!postsListContainer) return;

  postsListContainer.innerHTML = `
    <div style="text-align: center; padding: 3rem 0; color: var(--text-muted);">
      <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
      <p>Loading articles...</p>
    </div>
  `;

  try {
    let articleFiles = [];

    try {
      const apiResponse = await fetch(GITHUB_ARTICLES_API);
      if (apiResponse.ok) {
        const data = await apiResponse.json();
        if (Array.isArray(data)) {
          articleFiles = data
            .filter(file => file.name.endsWith('.md'))
            .map(file => ({
              name: file.name,
              download_url: file.download_url || `${RAW_ARTICLE_BASE}${file.name}`
            }));
        }
      }
    } catch (e) {
      console.warn('GitHub API request failed, using fallback list:', e);
    }

    if (articleFiles.length === 0) {
      articleFiles = FALLBACK_ARTICLES.map(name => ({
        name,
        download_url: `${RAW_ARTICLE_BASE}${name}`
      }));
    }

    const fetchedPosts = await Promise.all(
      articleFiles.map(async (file) => {
        try {
          const response = await fetch(file.download_url);
          if (!response.ok) return null;
          const content = await response.text();
          return parseYAMLFrontmatter(content, file.name);
        } catch (err) {
          console.error(`Failed to fetch article: ${file.name}`, err);
          return null;
        }
      })
    );

    postsData = fetchedPosts.filter(p => p && p.published !== false);

    // Fallback to local demo posts if network fetch failed completely
    if (postsData.length === 0) {
      postsData = LOCAL_DEMO_POSTS;
    }

    // Sort by date if provided, otherwise preserve original list order
    postsData.sort((a, b) => {
      if (a.date && b.date) return new Date(b.date) - new Date(a.date);
      return 0;
    });

    buildTagCloud();
    applyFilters();
    checkHashRoute();
  } catch (err) {
    console.error('Error loading blog posts:', err);
    postsData = LOCAL_DEMO_POSTS;
    buildTagCloud();
    applyFilters();
    checkHashRoute();
  }
}

/* -------------------------------------------------------------
 * 5. Live Search & Interactive Tag Cloud Filters
 * ------------------------------------------------------------- */
function initSearchAndFilter() {
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('clear-search-btn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      if (clearBtn) {
        clearBtn.style.display = searchQuery ? 'block' : 'none';
      }
      applyFilters();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchQuery = '';
        clearBtn.style.display = 'none';
        applyFilters();
      }
    });
  }
}

function buildTagCloud() {
  const tagCloudContainer = document.getElementById('tag-cloud');
  if (!tagCloudContainer) return;

  const tagMap = new Map();
  postsData.forEach(post => {
    if (post.tags) {
      const tags = post.tags.split(/\s+/).filter(t => t.startsWith('#'));
      tags.forEach(t => {
        tagMap.set(t, (tagMap.get(t) || 0) + 1);
      });
    }
  });

  if (tagMap.size === 0) {
    tagCloudContainer.innerHTML = '';
    return;
  }

  const allPill = `<span class="tag-filter-pill ${activeTagFilter === 'ALL' ? 'active' : ''}" onclick="selectTagFilter('ALL')">All (${postsData.length})</span>`;
  const tagPills = Array.from(tagMap.entries()).map(([tag, count]) => {
    const isActive = activeTagFilter === tag ? 'active' : '';
    return `<span class="tag-filter-pill ${isActive}" onclick="selectTagFilter('${tag}')">${tag} (${count})</span>`;
  }).join('');

  tagCloudContainer.innerHTML = allPill + tagPills;
}

function selectTagFilter(tag) {
  activeTagFilter = tag;
  buildTagCloud();
  applyFilters();
}

function applyFilters() {
  const filtered = postsData.filter(post => {
    if (activeTagFilter !== 'ALL') {
      const postTags = post.tags ? post.tags.split(/\s+/) : [];
      if (!postTags.includes(activeTagFilter)) {
        return false;
      }
    }

    if (searchQuery) {
      const inTitle = post.title.toLowerCase().includes(searchQuery);
      const inDesc = post.description.toLowerCase().includes(searchQuery);
      const inBody = post.body.toLowerCase().includes(searchQuery);
      const inTags = post.tags.toLowerCase().includes(searchQuery);
      return inTitle || inDesc || inBody || inTags;
    }

    return true;
  });

  renderPostsList(filtered);
}

function renderPostsList(posts) {
  const postsListContainer = document.getElementById('posts-list');
  if (!postsListContainer) return;

  if (posts.length === 0) {
    postsListContainer.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
        <p style="font-size: 1.1rem; font-weight: 500;">No articles match your current search.</p>
        <button onclick="resetSearchAndFilter()" style="margin-top: 1rem; background: transparent; border: 1px solid var(--accent-color); color: var(--accent-color); padding: 0.4rem 1rem; border-radius: 6px; cursor: pointer;">Reset Filters</button>
      </div>
    `;
    return;
  }

  postsListContainer.innerHTML = posts.map(post => {
    const tagPills = post.tags 
      ? post.tags.split(/\s+/).filter(t => t.startsWith('#')).map(t => `<span class="tag-pill">${t}</span>`).join('') 
      : '';

    return `
      <article class="post-card" onclick="openPost('${post.id}')" role="button" tabindex="0">
        ${post.cover_image ? `<div class="post-cover-thumb"><img src="${post.cover_image}" alt="${post.title}" loading="lazy"></div>` : ''}
        <div class="post-card-content">
          <div class="post-meta">
            ${post.date ? `<span><i class="far fa-calendar-alt"></i> ${post.date}</span><span>•</span>` : ''}
            <span><i class="far fa-clock"></i> ${post.readTime}</span>
          </div>
          <h3 class="post-title">${post.title}</h3>
          ${post.description ? `<p class="post-description">${post.description}</p>` : ''}
          ${tagPills ? `<div class="post-tags">${tagPills}</div>` : ''}
          <span class="read-more-btn">Read Article <i class="fas fa-arrow-right"></i></span>
        </div>
      </article>
    `;
  }).join('');
}

function resetSearchAndFilter() {
  searchQuery = '';
  activeTagFilter = 'ALL';
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('clear-search-btn');
  if (searchInput) searchInput.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  buildTagCloud();
  applyFilters();
}

/* -------------------------------------------------------------
 * 6. Top Reading Progress Bar
 * ------------------------------------------------------------- */
function initReadingProgress() {
  const progressBar = document.getElementById('reading-progress');
  if (!progressBar) return;

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const progressPercent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    progressBar.style.width = `${progressPercent}%`;
  });
}

/* -------------------------------------------------------------
 * 7. Table of Contents & Code Copy Buttons
 * ------------------------------------------------------------- */
function generateArticleTOC(container) {
  const tocContainer = document.getElementById('article-toc');
  if (!tocContainer) return;

  const headings = container.querySelectorAll('h2, h3');
  if (headings.length < 2) {
    tocContainer.style.display = 'none';
    return;
  }

  let tocHTML = `
    <div class="toc-header">
      <i class="fas fa-list-ul"></i> Table of Contents
    </div>
    <ul class="toc-list">
  `;

  headings.forEach((heading, idx) => {
    const headingText = heading.textContent.trim();
    const headingId = heading.id || `heading-${idx + 1}`;
    heading.id = headingId;

    const level = heading.tagName.toLowerCase() === 'h3' ? 'level-3' : 'level-2';

    tocHTML += `
      <li class="toc-item ${level}">
        <a href="#${headingId}" class="toc-link">${headingText}</a>
      </li>
    `;
  });

  tocHTML += `</ul>`;
  tocContainer.innerHTML = tocHTML;
  tocContainer.style.display = 'block';
}

function enhanceCodeBlocks(container) {
  const codeBlocks = container.querySelectorAll('pre');
  codeBlocks.forEach(pre => {
    if (pre.parentElement.classList.contains('code-block-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-code-btn';
    copyBtn.innerHTML = `<i class="far fa-copy"></i> Copy`;
    
    copyBtn.addEventListener('click', async () => {
      const codeText = pre.querySelector('code') ? pre.querySelector('code').innerText : pre.innerText;
      try {
        await navigator.clipboard.writeText(codeText);
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = `<i class="fas fa-check"></i> Copied!`;
        showToast('Code snippet copied to clipboard!');
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = `<i class="far fa-copy"></i> Copy`;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy code snippet:', err);
      }
    });

    wrapper.appendChild(copyBtn);
  });
}

/* -------------------------------------------------------------
 * 8. Interactive Expeditions & Outdoor Map (Leaflet.js)
 * ------------------------------------------------------------- */
function initExpeditionsMap() {
  if (leafletMapInstance) return;

  const mapContainer = document.getElementById('expeditions-map');
  if (!mapContainer) return;

  if (!window.L) {
    mapContainer.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
        <i class="fas fa-map-marked-alt" style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.5;"></i>
        <p style="font-size: 1.1rem; font-weight: 500;">Expeditions Map requires an active internet connection to load Leaflet tiles.</p>
      </div>
    `;
    return;
  }

  // Center on Tatra / Alps region
  leafletMapInstance = L.map('expeditions-map').setView([48.8, 17.5], 5);

  updateMapTileTheme();

  const expeditions = [
    {
      name: "Rysy Peak",
      elevation: "2,501 m",
      coords: [49.1794, 20.0881],
      type: "High Tatras, Poland / Slovakia",
      desc: "Highest peak in Poland. Steep alpine scramble with exposed chain sections.",
      icon: "⛰️"
    },
    {
      name: "Mont Blanc",
      elevation: "4,807 m",
      coords: [45.8326, 6.8652],
      type: "Graian Alps, France / Italy",
      desc: "Roof of Western Europe. Snow & ice climb via Goûter ridge traverse.",
      icon: "🏔️"
    },
    {
      name: "Babia Góra",
      elevation: "1,725 m",
      coords: [49.5733, 19.5297],
      type: "Zywiec Beskids, Poland",
      desc: "Mother of the Beskids. Famous for sunrise cloud inversions & winter winds.",
      icon: "⛰️"
    },
    {
      name: "Bieszczady Ridge Trail",
      elevation: "1,297 m (Połonina)",
      coords: [49.1233, 22.6133],
      type: "Bieszczady Mountains",
      desc: "Wild ridge walks across Połonina Caryńska & starlit wilderness camping.",
      icon: "🏕️"
    },
    {
      name: "Zugspitze Summit",
      elevation: "2,962 m",
      coords: [47.4210, 10.9853],
      type: "Wetterstein Alps, Germany",
      desc: "Germany's highest summit via the scenic Höllental gorge & Via Ferrata.",
      icon: "🏔️"
    },
    {
      name: "Kasprowy Wierch & Swidnica",
      elevation: "1,987 m",
      coords: [49.2319, 19.9814],
      type: "Western Tatras",
      desc: "Classic winter snowshoeing & alpine trail along the Polish-Slovak border.",
      icon: "🥾"
    }
  ];

  expeditions.forEach(spot => {
    const popupContent = `
      <div class="map-popup-card">
        <div class="map-popup-title">${spot.icon} ${spot.name}</div>
        <div class="map-popup-meta">${spot.elevation} • ${spot.type}</div>
        <div class="map-popup-desc">${spot.desc}</div>
      </div>
    `;

    L.marker(spot.coords)
      .addTo(leafletMapInstance)
      .bindPopup(popupContent);
  });
}

function updateMapTileTheme() {
  if (!leafletMapInstance || !window.L) return;

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  
  if (leafletTileLayer) {
    leafletMapInstance.removeLayer(leafletTileLayer);
  }

  if (currentTheme === 'dark') {
    leafletTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
    });
  } else {
    leafletTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    });
  }

  leafletTileLayer.addTo(leafletMapInstance);
}

/* -------------------------------------------------------------
 * 9. Expand Post & Navigation Routing
 * ------------------------------------------------------------- */
function openPost(postId) {
  const post = postsData.find(p => p.id === postId);
  if (!post) return;

  currentOpenedPost = post;

  const postsListSection = document.getElementById('posts-list-section');
  const nowSection = document.getElementById('now-section');
  const mapSection = document.getElementById('map-section');
  const postExpandedView = document.getElementById('post-expanded-view');
  const postContent = document.getElementById('post-content');

  if (!postExpandedView || !postContent) return;

  const htmlContent = window.marked ? marked.parse(post.body) : post.body;

  const tagPills = post.tags 
    ? post.tags.split(/\s+/).filter(t => t.startsWith('#')).map(t => `<span class="tag-pill">${t}</span>`).join('') 
    : '';

  postContent.innerHTML = `
    <header class="post-article-header">
      ${post.cover_image ? `<img src="${post.cover_image}" alt="${post.title}" class="post-cover-image">` : ''}
      <div class="post-meta" style="margin-bottom: 0.5rem; margin-top: ${post.cover_image ? '1rem' : '0'};">
        ${post.date ? `<span><i class="far fa-calendar-alt"></i> ${post.date}</span><span>•</span>` : ''}
        <span><i class="far fa-clock"></i> ${post.readTime}</span>
      </div>
      <h1 class="post-title" style="font-size: 2.2rem; margin-bottom: 0.75rem;">${post.title}</h1>
      ${post.description ? `<p class="post-description" style="font-size: 1.1rem; margin-bottom: 1rem;">${post.description}</p>` : ''}
      ${tagPills ? `<div class="post-tags" style="margin-bottom: 1.5rem;">${tagPills}</div>` : ''}
    </header>
    <div class="markdown-body">
      ${htmlContent}
    </div>
  `;

  generateArticleTOC(postContent);
  enhanceCodeBlocks(postContent);

  if (postsListSection) postsListSection.style.display = 'none';
  if (nowSection) nowSection.style.display = 'none';
  if (mapSection) mapSection.style.display = 'none';
  postExpandedView.style.display = 'block';
  
  window.location.hash = `post=${postId}`;
  document.getElementById('main-content').scrollIntoView({ behavior: 'smooth' });

  if (window.Prism) {
    Prism.highlightAllUnder(postContent);
  }
}

function closePost() {
  currentOpenedPost = null;
  window.location.hash = 'blog';
}

function initHashRouting() {
  window.addEventListener('hashchange', checkHashRoute);
  checkHashRoute();
}

function checkHashRoute() {
  const hash = window.location.hash;

  const postsListSection = document.getElementById('posts-list-section');
  const nowSection = document.getElementById('now-section');
  const mapSection = document.getElementById('map-section');
  const postExpandedView = document.getElementById('post-expanded-view');

  const navBlog = document.getElementById('nav-blog');
  const navNow = document.getElementById('nav-now');
  const navMap = document.getElementById('nav-map');

  [navBlog, navNow, navMap].forEach(el => el && el.classList.remove('active'));

  if (hash.startsWith('#post=')) {
    const postId = hash.replace('#post=', '');
    openPost(postId);
  } else if (hash === '#now') {
    if (postsListSection) postsListSection.style.display = 'none';
    if (postExpandedView) postExpandedView.style.display = 'none';
    if (mapSection) mapSection.style.display = 'none';
    if (nowSection) nowSection.style.display = 'block';
    if (navNow) navNow.classList.add('active');
  } else if (hash === '#map') {
    if (postsListSection) postsListSection.style.display = 'none';
    if (postExpandedView) postExpandedView.style.display = 'none';
    if (nowSection) nowSection.style.display = 'none';
    if (mapSection) mapSection.style.display = 'block';
    if (navMap) navMap.classList.add('active');

    initExpeditionsMap();
    if (leafletMapInstance) {
      setTimeout(() => leafletMapInstance.invalidateSize(), 200);
    }
  } else {
    // Default: #blog or empty
    if (nowSection) nowSection.style.display = 'none';
    if (mapSection) mapSection.style.display = 'none';
    if (postExpandedView) postExpandedView.style.display = 'none';
    if (postsListSection) postsListSection.style.display = 'block';
    if (navBlog) navBlog.classList.add('active');
  }
}

/* -------------------------------------------------------------
 * 10. Sharing & Toast Notifications
 * ------------------------------------------------------------- */
function copyArticleLink() {
  const currentUrl = window.location.href;
  navigator.clipboard.writeText(currentUrl).then(() => {
    showToast('Article link copied to clipboard!');
  }).catch(err => {
    console.error('Copy link failed:', err);
  });
}

function shareArticleTwitter() {
  if (!currentOpenedPost) return;
  const url = encodeURIComponent(window.location.href);
  const text = encodeURIComponent(`Check out "${currentOpenedPost.title}" by @devgrzegorz`);
  window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
}

function shareArticleLinkedIn() {
  if (!currentOpenedPost) return;
  const url = encodeURIComponent(window.location.href);
  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}
