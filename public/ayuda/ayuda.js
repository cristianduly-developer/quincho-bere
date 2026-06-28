document.addEventListener('DOMContentLoaded', function() {
  var sections = document.querySelectorAll('.section[id]');
  var navLinks = document.querySelectorAll('.sidebar a');
  var searchInput = document.getElementById('searchInput');

  // Sidebar active on scroll
  if (sections.length && 'IntersectionObserver' in window) {
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
  }

  // Search
  function doSearch(q) {
    q = (q || '').trim().toLowerCase();
    sections.forEach(function(sec) {
      sec.style.display = (!q || sec.textContent.toLowerCase().includes(q)) ? '' : 'none';
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', function() { doSearch(this.value); });
    searchInput.addEventListener('keyup',  function() { doSearch(this.value); });
  }

  // Smooth scroll — sidebar
  document.querySelectorAll('.sidebar a[href^="#"]').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      var t = document.querySelector(a.getAttribute('href'));
      if (t) t.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Smooth scroll — mobile pills
  document.querySelectorAll('.mobile-pills a[href^="#"]').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      var t = document.querySelector(a.getAttribute('href'));
      if (t) t.scrollIntoView({ behavior: 'smooth' });
    });
  });
});
