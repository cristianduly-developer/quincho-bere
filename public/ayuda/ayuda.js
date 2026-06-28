var sections = document.querySelectorAll('.section[id]');
var navLinks = document.querySelectorAll('.sidebar a');

var observer = new IntersectionObserver(function(entries) {
  entries.forEach(function(e) {
    if (e.isIntersecting) {
      navLinks.forEach(function(a) { a.classList.remove('active'); });
      var active = document.querySelector('.sidebar a[href="#' + e.target.id + '"]');
      if (active) active.classList.add('active');
    }
  });
}, { rootMargin: '-20% 0px -70% 0px' });

sections.forEach(function(s) { observer.observe(s); });

function doSearch(q) {
  q = q.trim().toLowerCase();
  sections.forEach(function(sec) {
    if (!q) { sec.style.display = ''; return; }
    var text = sec.textContent.toLowerCase();
    sec.style.display = text.includes(q) ? '' : 'none';
  });
}

document.getElementById('searchInput').addEventListener('input', function() {
  doSearch(this.value);
});

document.querySelectorAll('.sidebar a[href^="#"]').forEach(function(a) {
  a.addEventListener('click', function(e) {
    e.preventDefault();
    var target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});

document.querySelectorAll('.mobile-pills a').forEach(function(a) {
  a.addEventListener('click', function(e) {
    e.preventDefault();
    var target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});
