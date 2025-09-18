/* Responsive canvas script
   - Scales the canvas to its container width while preserving content.
   - Uses pointer events for mouse & touch.
   - Keeps strokes crisp using devicePixelRatio.
*/

const colorPicker = document.querySelector("#colorPicker");
const canvasColor = document.querySelector("#canvasColor");
const canvas = document.querySelector("#canvas");
const clearButton = document.querySelector("#clearButton");
const saveButton = document.querySelector("#saveButton");
const fontSize = document.querySelector("#fontSize");
const retrieveButton = document.querySelector("#retrieveButton");
const ctx = canvas.getContext("2d");

let isDrawing = false;
let lastX = 0;
let lastY = 0;

/* Base design size (aspect ratio preserved) */
const BASE_W = 800;
const BASE_H = 350;

/* store current settings to reapply after resize */
let currentStroke = "#000000";
let currentBg = "#ffffff";
let currentLineWidth = 5;

/* --- Utility: debounce --- */
function debounce(fn, wait = 120) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* --- Resize canvas to fit container while preserving content --- */
function resizeCanvasAndRestore() {
  // keep a snapshot of current drawing
  const snapshot = canvas.toDataURL();

  // container width (inside #main). Provide a small padding allowance.
  const container = canvas.parentElement;
  const style = getComputedStyle(container);
  const paddingX = parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0);
  const availableWidth = Math.max(240, container.clientWidth - paddingX); // minimum width 240
  const displayWidth = Math.min(BASE_W, availableWidth);
  const displayHeight = Math.round((displayWidth * BASE_H) / BASE_W);

  // device pixel ratio for crispness
  const dpr = window.devicePixelRatio || 1;

  // set CSS size (what user sees)
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  // set backing store size
  canvas.width = Math.round(displayWidth * dpr);
  canvas.height = Math.round(displayHeight * dpr);

  // reset transform then scale so drawing coordinates use CSS pixels
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  // reapply styles
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = currentStroke;
  ctx.fillStyle = currentBg;
  ctx.lineWidth = currentLineWidth;

  // if snapshot contains content, draw it (it will be scaled)
  if (snapshot) {
    const img = new Image();
    img.onload = () => {
      // clear then draw snapshot scaled to current display size
      ctx.clearRect(0, 0, displayWidth, displayHeight);
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
    };
    img.src = snapshot;
  } else {
    // no snapshot -> fill background
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.fillStyle = currentBg;
    ctx.fillRect(0, 0, displayWidth, displayHeight);
  }
}

/* Call once at start */
resizeCanvasAndRestore();

/* Recalculate on resize (debounced) */
window.addEventListener("resize", debounce(resizeCanvasAndRestore, 140));

/* --- Pointer drawing (works for mouse & touch) --- */
canvas.addEventListener("pointerdown", (e) => {
  isDrawing = true;
  // capture pointer to keep receiving events even if finger/mouse leaves canvas during stroke
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  lastX = e.offsetX;
  lastY = e.offsetY;
});

canvas.addEventListener("pointermove", (e) => {
  if (!isDrawing) return;
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();

  lastX = e.offsetX;
  lastY = e.offsetY;
});

function stopDrawing(e) {
  if (isDrawing && e && e.pointerId) {
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }
  isDrawing = false;
}

canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);
canvas.addEventListener("pointerout", stopDrawing);

/* --- Controls behavior --- */
// color (stroke)
colorPicker.addEventListener("change", (e) => {
  currentStroke = e.target.value;
  ctx.strokeStyle = currentStroke;
  ctx.fillStyle = currentStroke;
});

// background color
canvasColor.addEventListener("change", (e) => {
  currentBg = e.target.value;
  // save visible drawing first as snapshot then fill background below
  // To preserve existing drawing with new background, we must composite:
  // Simple approach: fill the background rectangle under existing drawing
  // We'll draw a fillRect beneath by temporarily creating an offscreen copy
  const displayW = canvas.clientWidth;
  const displayH = canvas.clientHeight;
  const data = canvas.toDataURL();
  const img = new Image();
  img.onload = () => {
    ctx.save();
    ctx.clearRect(0, 0, displayW, displayH);
    ctx.fillStyle = currentBg;
    ctx.fillRect(0, 0, displayW, displayH);
    ctx.drawImage(img, 0, 0, displayW, displayH);
    ctx.restore();
  };
  img.src = data;
});

// line width via select
fontSize.addEventListener("change", (e) => {
  const v = Number(e.target.value) || 5;
  currentLineWidth = v;
  ctx.lineWidth = currentLineWidth;
});

// clear canvas
clearButton.addEventListener("click", () => {
  const displayW = canvas.clientWidth;
  const displayH = canvas.clientHeight;
  ctx.clearRect(0, 0, displayW, displayH);
  // fill with current background
  ctx.fillStyle = currentBg;
  ctx.fillRect(0, 0, displayW, displayH);
});

// save & download (also save to localStorage)
saveButton.addEventListener("click", () => {
  const dataURL = canvas.toDataURL();
  localStorage.setItem("canvasContents", dataURL);

  // trigger download
  const link = document.createElement("a");
  link.download = "my-canvas.png";
  link.href = dataURL;
  document.body.appendChild(link);
  link.click();
  link.remove();
});

// retrieve saved drawing
retrieveButton.addEventListener("click", () => {
  const saved = localStorage.getItem("canvasContents");
  if (!saved) {
    alert("No saved drawing found in localStorage.");
    return;
  }
  const img = new Image();
  img.onload = () => {
    const displayW = canvas.clientWidth;
    const displayH = canvas.clientHeight;
    ctx.clearRect(0, 0, displayW, displayH);
    ctx.drawImage(img, 0, 0, displayW, displayH);

    // keep currentBg consistent (we can't know original background from dataURL),
    // but we can leave currentBg unchanged.
  };
  img.src = saved;
});

/* Optional: If the user resized the window and changed DPR, reapply transform and restore content */
window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener?.('change', debounce(resizeCanvasAndRestore, 200));
