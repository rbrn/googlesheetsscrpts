// Dynamically generated URLs for LC futures prices
const currentDate = new Date();
const currentMonth = currentDate.getMonth();

const urls = [];

for (let i = 0; i < 3; i++) {
    const month = (currentMonth + i) % 12;
    const year = currentDate.getFullYear() + Math.floor((currentMonth + i) / 12);
    const url = `https://example.com/futures/lc/${year}-${String(month + 1).padStart(2, '0')}`;
    urls.push(url);
}

console.log(urls);
