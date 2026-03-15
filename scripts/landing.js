// --- NAVBAR SCROLL EFFECT ---
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// --- SCROLL REVEAL ANIMATIONS ---
function reveal() {
    var reveals = document.querySelectorAll(".reveal");
    for (var i = 0; i < reveals.length; i++) {
        var windowHeight = window.innerHeight;
        var elementTop = reveals[i].getBoundingClientRect().top;
        var elementVisible = 100; // when to trigger the animation
        
        if (elementTop < windowHeight - elementVisible) {
            reveals[i].classList.add("active");
        }
    }
}
window.addEventListener("scroll", reveal);
// Trigger once on load for elements already in view
reveal();

// --- CUSTOMER CARE TEASER ---
function triggerSupport() {
    // We will build the actual chat/ticket interface next!
    alert("BITS Customer Care & Support Center initialized. \n\n(This floating widget will open a live chat or ticketing system in the next phase of development!)");
}