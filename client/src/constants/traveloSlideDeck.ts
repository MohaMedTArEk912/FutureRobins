import type { MotionPresentation } from '../types';

export const TRAVELO_PART2_DECK: MotionPresentation = {
    title: 'Travelo Project (Part 2) — Session 10',
    description: '3C Coding School • Introduction to Web Development: Scanning Web Page Structure, Features Section & Footer Section',
    theme: 'dark-tech',
    sourceFormat: 'json',
    slides: [
        {
            id: 'travelo_slide_1',
            order: 0,
            layout: 'hero',
            motion: 'zoom-in',
            title: 'Travelo Project (Part 2)',
            subtitle: 'Session 10 • Introduction to Web Development • 3C Coding School',
            body: 'Today you will learn how to scan a real landing page structure, build a two-half Features section, and architect a multi-column Footer.',
            bullets: ['Scanning Web Page Structure', 'Features Section', 'Footer Section'],
            callout: 'Interactive Board: Click sections, draw annotations, and answer Check-Up questions live!',
            speakerNotes: 'Welcome students to Session 10! Remind them what we built in Travelo Part 1 (Header, Hero, Services) and preview today’s two new sections.',
            durationSeconds: 45
        },
        {
            id: 'travelo_slide_2',
            order: 1,
            layout: 'bullets',
            motion: 'stagger',
            title: 'Session Outlines',
            subtitle: '3C Coding School • Roadmap for Today',
            bullets: [
                'Scanning Web Page Structure (Top-to-Bottom Blueprint)',
                'Features Section (50/50 Split with Stacked Image Cards)',
                'Footer Section (Top Navbar + 3-Column Info Grid)',
                'Home Work Challenge (Complete the Footer Icons & Columns)'
            ],
            callout: 'Always scan a design into boxes BEFORE writing a single line of HTML or CSS.',
            speakerNotes: 'Walk through the 4 milestones. Emphasize thinking in layout boxes first.',
            durationSeconds: 40
        },
        {
            id: 'travelo_slide_3',
            order: 2,
            layout: 'wireframe',
            motion: 'fade-up',
            title: 'Scanning Web Page Structure',
            subtitle: 'Click any section on the Travelo blueprint to inspect its role & HTML tag',
            body: 'Every modern webpage stacks clean semantic sections from top to bottom. Click a layer below to highlight it for the class:',
            visualBlock: {
                kind: 'page-structure',
                sections: [
                    {
                        id: 'header',
                        label: 'Header',
                        tag: '<header>',
                        description: 'Top navigation bar with Travelo logo, links, and call-to-action button.',
                        code: '<header class="navbar">\n  <div class="logo">Travelo</div>\n  <nav>Home • Destinations • About • Contact</nav>\n</header>'
                    },
                    {
                        id: 'hero',
                        label: 'Hero Section',
                        tag: '<section class="hero">',
                        description: 'Full-width welcome banner with headline, search bar, and background travel photo.',
                        code: '<section class="hero">\n  <h1>Explore the World</h1>\n  <p>Discover curated trips & adventures.</p>\n</section>'
                    },
                    {
                        id: 'services',
                        label: 'Services Section',
                        tag: '<section class="services">',
                        description: 'Row of service cards highlighting flights, hotels, and guided tours.',
                        code: '<section class="services">\n  <div class="service-card">Flights</div>\n  <div class="service-card">Hotels</div>\n  <div class="service-card">Tours</div>\n</section>'
                    },
                    {
                        id: 'features',
                        label: 'Features Section (Today!)',
                        tag: '<section class="features">',
                        description: 'Two equal halves: Left featured story card + Right two stacked image-background cards.',
                        code: '<section class="features">\n  <div class="left-card">...</div>\n  <div class="right-stack">\n    <div class="bg-card">Card 1</div>\n    <div class="bg-card">Card 2</div>\n  </div>\n</section>',
                        highlight: true
                    },
                    {
                        id: 'footer',
                        label: 'Footer Section (Today!)',
                        tag: '<footer>',
                        description: 'Two-part footer: Top navbar echo + Bottom 3 columns (Location, Contacts, Social Media).',
                        code: '<footer>\n  <div class="footer-top">Logo + Nav Tabs</div>\n  <div class="footer-cols">Location | Contacts | Social</div>\n</footer>',
                        highlight: true
                    }
                ]
            },
            callout: 'Notice how Part 1 covered Header, Hero, and Services — today we finish Features & Footer!',
            speakerNotes: 'Click through Header -> Hero -> Services -> Features -> Footer so students visually connect Part 1 to Part 2.',
            durationSeconds: 90
        },
        {
            id: 'travelo_slide_4',
            order: 3,
            layout: 'checkup',
            motion: 'pop',
            title: 'Check-Up #1: Page Structure',
            subtitle: 'Quick Classroom Check-Up',
            checkupQuestion: {
                question: 'Which two Travelo Project sections are we building today in Part 2?',
                options: [
                    'Header & Hero Section',
                    'Features Section & Footer Section',
                    'Services Section & Login Modal',
                    'Header & Services Section'
                ],
                correctAnswer: 1,
                explanation: 'Part 1 covered Header, Hero, and Services. Part 2 focuses on the Features Section and the Footer Section.',
                points: 10
            },
            speakerNotes: 'Give students 20 seconds to vote live, then click Reveal Answer.',
            durationSeconds: 45
        },
        {
            id: 'travelo_slide_5',
            order: 4,
            layout: 'wireframe',
            motion: 'slide-left',
            title: 'Features Section Architecture',
            subtitle: 'Two Equal Halves (50% Left / 50% Right)',
            body: 'The section is divided into two equal halves using Flexbox or CSS Grid:',
            bullets: [
                'Left side: 1 full-height card with a heading and a descriptive paragraph.',
                'Right side: 2 equal cards stacked vertically, each with a background image.'
            ],
            visualBlock: {
                kind: 'split-cards',
                leftCard: {
                    tag: 'Left Half (50%)',
                    title: 'Why Travel With Us?',
                    body: 'A single featured card containing a bold heading and a short explanatory paragraph.'
                },
                rightCards: [
                    { title: 'Card 1: Mountain Escapes', subtitle: 'Background Image + Overlay', badge: '50% Height' },
                    { title: 'Card 2: Coastal Retreats', subtitle: 'Background Image + Overlay', badge: '50% Height' }
                ]
            },
            codeSnippet: {
                language: 'css',
                code: `.features {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 24px;\n}\n.right-col {\n  display: flex;\n  flex-direction: column;\n  gap: 24px;\n}\n.bg-card {\n  flex: 1;\n  background-size: cover;\n  background-position: center;\n}`
            },
            callout: 'Pro Tip: Use background-size: cover; and background-position: center; on both right-side cards!',
            speakerNotes: 'Highlight the CSS grid 1fr 1fr split and nested flex-direction: column on the right side.',
            durationSeconds: 90
        },
        {
            id: 'travelo_slide_6',
            order: 5,
            layout: 'wireframe',
            motion: 'fade-up',
            title: 'Footer Section Architecture',
            subtitle: 'Two Horizontal Parts + Three Bottom Columns',
            body: 'The footer is divided into two parts: a top navigation strip and a 3-column contact/info bar.',
            bullets: [
                'Part 1 (Top): Contains the Logo and the same Navigation tabs as the header.',
                'Part 2 (Bottom): Split into 3 equal columns — Location, Contacts, and Social Media.'
            ],
            visualBlock: {
                kind: 'footer-anatomy',
                topNav: {
                    brand: '3C Travelo',
                    links: ['Home', 'Features', 'Services', 'Contact']
                },
                columns: [
                    { title: 'Location', items: ['Cairo, Egypt', '3C Coding Campus, Bldg 4'] },
                    { title: 'Contacts', items: ['hello@travelo.dev', '+20 100 000 0000'] },
                    { title: 'Social Media', items: ['Instagram', 'Facebook', 'YouTube / X'] }
                ]
            },
            codeSnippet: {
                language: 'html',
                code: `<footer class="site-footer">\n  <div class="footer-top">\n    <span class="logo">Travelo</span>\n    <nav><!-- Navigation tabs --></nav>\n  </div>\n  <div class="footer-columns">\n    <div>Location</div>\n    <div>Contacts</div>\n    <div>Social Media</div>\n  </div>\n</footer>`
            },
            callout: 'Part 1 = Flex row (space-between). Part 2 = 3-column Grid (repeat(3, 1fr)).',
            speakerNotes: 'Use the pen tool to circle Part 1 (Logo + Nav tabs) and Part 2 (3 columns).',
            durationSeconds: 90
        },
        {
            id: 'travelo_slide_7',
            order: 6,
            layout: 'checkup',
            motion: 'pop',
            title: 'Check-Up #2: Features & Footer',
            subtitle: 'Check Understanding Before Homework',
            checkupQuestion: {
                question: 'In the Travelo Footer section, what goes inside Part 2 (the bottom section)?',
                options: [
                    'A hero banner and a signup form',
                    'Two stacked cards with background images',
                    'Three columns: Location, Contacts, and Social Media',
                    'Only the website logo'
                ],
                correctAnswer: 2,
                explanation: 'Part 1 of the footer repeats the Logo + Navigation bar, and Part 2 splits into 3 columns for Location, Contacts, and Social Media.',
                points: 10
            },
            speakerNotes: 'Confirm everyone understands the 2-part footer layout before showing the homework brief.',
            durationSeconds: 45
        },
        {
            id: 'travelo_slide_8',
            order: 7,
            layout: 'homework',
            motion: 'zoom-in',
            title: 'Home Work: Complete the Footer',
            subtitle: '3C Coding School • Session 10 Assignment',
            body: 'Complete the Travelo Footer section in your project and submit the session homework quiz.',
            bullets: [
                'Build Part 1 of the footer with the Logo & Navigation tabs',
                'Split Part 2 into 3 equal CSS Grid/Flex columns',
                'Add Location address, Contacts (email/phone), and Social Media icons',
                'Complete the Session 10 Homework Quiz on the platform'
            ],
            callout: 'Teacher Tip: Click "Finish Session & Unlock Homework" below so students can start immediately!',
            speakerNotes: 'Wrap up class, click Finish Session, and remind students to complete their homework.',
            durationSeconds: 60
        }
    ]
};
