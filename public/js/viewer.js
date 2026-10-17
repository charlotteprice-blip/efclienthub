// Viewer shell behaviour shared by every signed in page: the menu drawer on
// small screens and the account menu. Import once per page.

const viewer = document.querySelector('.viewer');
const menuButton = document.querySelector('.menu-button');
const sidebar = document.querySelector('.sidebar');

function setMenu(open) {
  if (!viewer) return;
  viewer.dataset.menu = open ? 'open' : 'closed';
  menuButton?.setAttribute('aria-expanded', String(open));
  if (open) {
    sidebar?.querySelector('a, button')?.focus();
  } else {
    menuButton?.focus();
  }
}

menuButton?.addEventListener('click', () => setMenu(viewer.dataset.menu !== 'open'));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && viewer?.dataset.menu === 'open') setMenu(false);
});

// Clicking the dimmed area outside the drawer closes it.
document.addEventListener('click', (event) => {
  if (viewer?.dataset.menu !== 'open') return;
  if (sidebar?.contains(event.target) || menuButton?.contains(event.target)) return;
  setMenu(false);
});

window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => {
  if (e.matches && viewer) viewer.dataset.menu = 'closed';
});
