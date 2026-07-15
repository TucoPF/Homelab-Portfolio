document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. FILTERING FUNCTIONALITY
    // =========================================================================
    const filterButtons = document.querySelectorAll('.tab-btn');
    const cards = document.querySelectorAll('.role-card');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            button.classList.add('active');

            const filterValue = button.getAttribute('data-filter');

            cards.forEach(card => {
                const cardCategory = card.getAttribute('data-category');
                
                if (filterValue === 'all' || cardCategory === filterValue) {
                    card.classList.remove('hide');
                    // Add slight entry animation
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(10px)';
                    setTimeout(() => {
                        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    }, 50);
                } else {
                    card.classList.add('hide');
                }
            });
        });
    });

    // =========================================================================
    // 2. ACCORDION (TROUBLESHOOTING CASE STUDIES)
    // =========================================================================
    const accordions = document.querySelectorAll('.troubleshooting-accordion');

    accordions.forEach(accordion => {
        const trigger = accordion.querySelector('.accordion-trigger');
        const content = accordion.querySelector('.accordion-content');

        trigger.addEventListener('click', () => {
            const isOpen = accordion.classList.contains('open');

            // Close all other accordions for clean UX
            accordions.forEach(otherAcc => {
                if (otherAcc !== accordion && otherAcc.classList.contains('open')) {
                    otherAcc.classList.remove('open');
                    otherAcc.querySelector('.accordion-content').style.maxHeight = null;
                }
            });

            // Toggle active state
            if (isOpen) {
                accordion.classList.remove('open');
                content.style.maxHeight = null;
            } else {
                accordion.classList.add('open');
                // Calculate real height of inner contents including padding
                content.style.maxHeight = content.scrollHeight + 'px';
            }
        });
    });
});
