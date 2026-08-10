// App Initialization & State
const GITHUB_ARTICLES_API = 'https://api.github.com/repos/devmonte/blog-articles/contents/articles?ref=master';
const RAW_ARTICLE_BASE = 'https://raw.githubusercontent.com/devmonte/blog-articles/master/articles/';
const RAW_REPO_BASE = 'https://raw.githubusercontent.com/devmonte/blog-articles/master/';

const FALLBACK_ARTICLES = [
  'git-branching-strategy.md',
  'scrum-training.md'
];

let postsData = [];

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initTitleRotator();
  loadBlogPosts();
  initHashRouting();
});

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

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const themeIcon = document.querySelector('#theme-toggle i');
  if (themeIcon) {
    themeIcon.className = theme === 'dark' ? 'far fa-sun' : 'far fa-moon';
  }
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
  // e.g. ![alt](../img/branching.png) -> https://raw.githubusercontent.com/devmonte/blog-articles/master/img/branching.png
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

    // Sort by date if provided, otherwise preserve original list order
    postsData.sort((a, b) => {
      if (a.date && b.date) return new Date(b.date) - new Date(a.date);
      return 0;
    });

    renderPostsList(postsData);
    checkHashRoute();
  } catch (err) {
    console.error('Error loading blog posts:', err);
    postsListContainer.innerHTML = `<p style="color: var(--text-muted);">Unable to load articles at this time.</p>`;
  }
}

function renderPostsList(posts) {
  const postsListContainer = document.getElementById('posts-list');
  if (!postsListContainer) return;

  if (posts.length === 0) {
    postsListContainer.innerHTML = `<p style="color: var(--text-muted);">No articles found.</p>`;
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

/* -------------------------------------------------------------
 * 5. Expand Post & Navigation Routing
 * ------------------------------------------------------------- */
function openPost(postId) {
  const post = postsData.find(p => p.id === postId);
  if (!post) return;

  const postsListSection = document.getElementById('posts-list-section');
  const postExpandedView = document.getElementById('post-expanded-view');
  const postContent = document.getElementById('post-content');

  if (!postsListSection || !postExpandedView || !postContent) return;

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

  postsListSection.style.display = 'none';
  postExpandedView.style.display = 'block';
  
  window.location.hash = `post=${postId}`;

  document.getElementById('blog').scrollIntoView({ behavior: 'smooth' });

  if (window.Prism) {
    Prism.highlightAllUnder(postContent);
  }
}

function closePost() {
  const postsListSection = document.getElementById('posts-list-section');
  const postExpandedView = document.getElementById('post-expanded-view');

  if (postsListSection && postExpandedView) {
    postExpandedView.style.display = 'none';
    postsListSection.style.display = 'block';
    window.location.hash = 'blog';
  }
}

function initHashRouting() {
  window.addEventListener('hashchange', checkHashRoute);
}

function checkHashRoute() {
  const hash = window.location.hash;
  if (hash.startsWith('#post=')) {
    const postId = hash.replace('#post=', '');
    openPost(postId);
  } else if (hash === '#blog' || hash === '') {
    const postsListSection = document.getElementById('posts-list-section');
    const postExpandedView = document.getElementById('post-expanded-view');
    if (postsListSection && postExpandedView) {
      postExpandedView.style.display = 'none';
      postsListSection.style.display = 'block';
    }
  }
}
