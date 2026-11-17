import type { MotionPresentation } from '../types';

export const SAMPLE_FULL_PRESENTATION: Omit<MotionPresentation, 'presentationId'> = {
    title: 'Sample Interactive Session Presentation',
    description: 'Complete template showing Hero, Blueprint Wireframe visualBlock, Code Lab, Live Check-Up Quiz, and Summary slides.',
    theme: 'bento',
    sourceFormat: 'json',
    slides: [
        {
            id: 'sample_slide_1',
            order: 0,
            layout: 'hero',
            motion: 'zoom-in',
            title: 'Lesson Title Goes Here',
            subtitle: 'Session 01 • Course Name',
            body: 'Introduce what students will build or master during this live session.',
            bullets: ['Core Concept 1', 'Hands-On Demo', 'Live Check-Up Quiz'],
            callout: 'Interactive Board: Click sections, draw annotations, and answer Check-Up questions live!',
            speakerNotes: 'Welcome students and outline the 3 learning objectives for today.',
            durationSeconds: 45
        },
        {
            id: 'sample_slide_2',
            order: 1,
            layout: 'wireframe',
            motion: 'fade-up',
            title: 'Interactive Blueprint Breakdown',
            subtitle: 'Click each section to inspect it live',
            body: 'Use visualBlock.sections to build clickable concept diagrams.',
            visualBlock: {
                kind: 'page-structure',
                sections: [
                    {
                        id: 'sec_1',
                        label: '1. Header & Navigation',
                        tag: '<header>',
                        description: 'Contains the brand mark and primary navigation links.',
                        highlight: true,
                        code: '<header class="site-header">\n  <nav>Logo + Links</nav>\n</header>'
                    },
                    {
                        id: 'sec_2',
                        label: '2. Main Content Section',
                        tag: '<main>',
                        description: 'Core interactive workspace or lesson content block.'
                    }
                ]
            },
            bullets: [
                'Break problems into reusable visual sections.',
                'Click each block on the board to highlight it for students.'
            ],
            speakerNotes: 'Click block 1 and explain why semantic structure matters.',
            durationSeconds: 75
        },
        {
            id: 'sample_slide_3',
            order: 2,
            layout: 'code',
            motion: 'slide-left',
            title: 'Code Walkthrough Example',
            subtitle: 'Readable pattern with clean structure',
            body: 'Pair concise takeaways with a syntax-formatted code snippet.',
            bullets: [
                'Keep examples focused on one concept per slide.',
                'Use the pen tool to circle key lines while explaining.'
            ],
            codeSnippet: {
                language: 'html',
                code: '<section class="card">\n  <h2>Clean Structure</h2>\n  <p>Reusable, accessible markup.</p>\n</section>'
            },
            callout: 'Pro Tip: Annotate live on screen using Pen or Laser mode!',
            speakerNotes: 'Walk line-by-line through the markup.',
            durationSeconds: 60
        },
        {
            id: 'sample_slide_4',
            order: 3,
            layout: 'checkup',
            motion: 'pop',
            title: 'Quick Knowledge Check-Up',
            subtitle: 'Live Student Poll',
            checkupQuestion: {
                question: 'Which HTML landmark should wrap the primary page content?',
                options: ['<footer>', '<main>', '<span>', '<meta>'],
                correctAnswer: 1,
                explanation: '<main> represents the dominant, unique content of the document body.',
                points: 10
            },
            speakerNotes: 'Give students 20 seconds to vote before clicking Reveal Answer.',
            durationSeconds: 45
        },
        {
            id: 'sample_slide_5',
            order: 4,
            layout: 'summary',
            motion: 'fade-up',
            title: 'Session Wrap-Up',
            subtitle: 'Key Takeaways & Next Steps',
            bullets: [
                'Structure concepts clearly before writing code.',
                'Review speaker notes & check-up explanations.',
                'Complete the unlocked session quiz homework.'
            ],
            speakerNotes: 'Summarize today’s session and unlock student homework.',
            durationSeconds: 40
        }
    ]
};

export const SAMPLE_MINIMAL_PRESENTATION: Omit<MotionPresentation, 'presentationId'> = {
    title: 'My New Session Deck',
    description: 'Minimal starter presentation template ready for editing.',
    theme: 'bento',
    sourceFormat: 'json',
    slides: [
        {
            id: 'slide_1',
            order: 0,
            layout: 'hero',
            motion: 'zoom-in',
            title: 'Topic Overview',
            subtitle: 'Module Introduction',
            body: 'Short introduction to the session topic.',
            bullets: ['Objective 1', 'Objective 2'],
            speakerNotes: 'Introduce today’s topic.',
            durationSeconds: 45
        },
        {
            id: 'slide_2',
            order: 1,
            layout: 'bullets',
            motion: 'stagger',
            title: 'Key Concepts',
            bullets: ['First key concept', 'Second key concept', 'Third key concept'],
            callout: 'Remember this key rule!',
            speakerNotes: 'Explain each concept with a concrete example.',
            durationSeconds: 60
        },
        {
            id: 'slide_3',
            order: 2,
            layout: 'checkup',
            motion: 'pop',
            title: 'Quick Check-Up',
            checkupQuestion: {
                question: 'Sample check-up question?',
                options: ['Option A', 'Option B', 'Option C', 'Option D'],
                correctAnswer: 0,
                explanation: 'Explain why Option A is right.',
                points: 10
            },
            speakerNotes: 'Review the poll results together.',
            durationSeconds: 45
        }
    ]
};
