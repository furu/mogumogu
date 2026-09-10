const feed = document.getElementById("feed");
const tpl = document.getElementById("cardTpl");
const hint = document.getElementById("hint");
const soundToggle = document.getElementById("soundToggle");

const BATCH = 5;
const KEEP_CARDS = 24;

let filter = "all";
let muted = true;
let catalog = [];
let queue = [];
const likes = new Map();
const players = new WeakMap();

const apiReady = new Promise((resolve) => {
  window.onYouTubeIframeAPIReady = resolve;
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
});

function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const pool = () => catalog.filter((c) => filter === "all" || c.kind === filter);

function nextClip() {
  if (!queue.length) queue = shuffle(pool());
  return queue.pop();
}

const viewport = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const player = players.get(entry.target);
      if (entry.isIntersecting) {
        if (player) player.playVideo?.();
        else mountPlayer(entry.target);
      } else {
        player?.pauseVideo?.();
      }
    }
  },
  { threshold: 0.55 }
);

const tailWatcher = new IntersectionObserver(
  (entries) => {
    if (entries.some((e) => e.isIntersecting)) appendBatch();
  },
  { rootMargin: "600px" }
);

async function mountPlayer(card) {
  await apiReady;
  if (players.has(card)) return;
  const host = card.querySelector(".card__player");
  const videoId = card.dataset.videoId;
  const player = new YT.Player(host, {
    videoId,
    playerVars: {
      autoplay: 1,
      mute: 1,
      controls: 0,
      loop: 1,
      playlist: videoId,
      rel: 0,
      playsinline: 1,
      modestbranding: 1,
      iv_load_policy: 3,
    },
    events: {
      onReady: (e) => {
        if (muted) e.target.mute();
        else e.target.unMute();
        e.target.playVideo();
      },
      // Some videos block embedding; skip straight to the next clip.
      onError: () => card.classList.add("card--unavailable"),
    },
  });
  players.set(card, player);
}

function makeCard(clip) {
  const card = tpl.content.firstElementChild.cloneNode(true);
  card.dataset.videoId = clip.videoId;
  card.classList.toggle("card--vertical", Boolean(clip.vertical));
  card.querySelector(".card__title").textContent = clip.title;
  card.querySelector(".card__sub").textContent = `${clip.kind === "dog" ? "🐶" : "🐱"} ${clip.channel}`;
  card.querySelector(".card__thumb").style.backgroundImage =
    `url(https://i.ytimg.com/vi/${clip.videoId}/hqdefault.jpg)`;
  card.querySelector(".card__source").href = `https://www.youtube.com/watch?v=${clip.videoId}`;

  const like = card.querySelector(".card__like");
  const render = () => {
    const liked = likes.get(clip.videoId) ?? false;
    like.classList.toggle("is-liked", liked);
    like.textContent = liked ? "❤️" : "🤍";
  };
  like.addEventListener("click", () => {
    likes.set(clip.videoId, !(likes.get(clip.videoId) ?? false));
    render();
  });
  render();

  viewport.observe(card);
  return card;
}

function appendBatch() {
  if (!pool().length) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < BATCH; i++) frag.appendChild(makeCard(nextClip()));
  feed.appendChild(frag);
  trim();
  const tail = feed.lastElementChild;
  if (tail) tailWatcher.observe(tail);
}

// Keeps the DOM (and the number of live players) bounded during a long session.
function trim() {
  while (feed.children.length > KEEP_CARDS) {
    const first = feed.firstElementChild;
    if (first.getBoundingClientRect().bottom > 0) break;
    viewport.unobserve(first);
    players.get(first)?.destroy?.();
    const height = first.offsetHeight;
    first.remove();
    feed.scrollTop -= height;
  }
}

function reset() {
  feed.querySelectorAll(".card").forEach((card) => {
    viewport.unobserve(card);
    players.get(card)?.destroy?.();
  });
  feed.replaceChildren();
  feed.scrollTop = 0;
  queue = [];
  appendBatch();
}

soundToggle.addEventListener("click", () => {
  muted = !muted;
  soundToggle.textContent = muted ? "🔇 音を出す" : "🔊 音を消す";
  soundToggle.setAttribute("aria-pressed", String(!muted));
  feed.querySelectorAll(".card").forEach((card) => {
    const player = players.get(card);
    if (muted) player?.mute?.();
    else player?.unMute?.();
  });
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    filter = chip.dataset.filter;
    reset();
  });
});

feed.addEventListener(
  "scroll",
  () => {
    hint.classList.add("is-hidden");
    trim();
  },
  { passive: true }
);

document.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault();
  feed.scrollBy({ top: (e.key === "ArrowDown" ? 1 : -1) * feed.clientHeight, behavior: "smooth" });
});

const res = await fetch("data/catalog.json", { cache: "no-store" });
catalog = (await res.json()).clips ?? [];
appendBatch();
