document.addEventListener('DOMContentLoaded', () => {
  const input = document.querySelector('#guide-search');
  const cards = [...document.querySelectorAll('.guide-card')];
  if (!input) return;
  input.addEventListener('input', () => {
    const query = input.value.trim().toLocaleLowerCase('fa');
    for (const card of cards) {
      const text = (card.innerText + ' ' + (card.dataset.search || '')).toLocaleLowerCase('fa');
      card.hidden = !!query && !text.includes(query);
    }
  });
});
