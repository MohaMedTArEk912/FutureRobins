import type { Plugin } from 'vite';
import {
    getPublicPath, PUBLIC_ALIASES, PUBLIC_PAGES, SITE_NAME, SOCIAL_IMAGE_ALT,
    SOCIAL_IMAGE_HEIGHT, SOCIAL_IMAGE_WIDTH
} from '../src/seo';
import type { PublicPath } from '../src/seo';

const DEFAULT_SITE_URL = 'https://futurerobins.vercel.app';
const METADATA = '<!-- page metadata -->';

function escapeHtml(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function seo(siteUrl: string | undefined, indexable: boolean): Plugin {
    const site = new URL(siteUrl?.trim() || DEFAULT_SITE_URL);
    if (site.protocol !== 'https:' || site.href !== `${site.origin}/`) {
        throw new Error('SITE_URL must be an HTTPS origin, such as https://quiz.example.com.');
    }

    const pages = Object.keys(PUBLIC_PAGES) as PublicPath[];
    const image = new URL('/og-image.png', site).href;

    function renderMetadata(path?: PublicPath): string {
        const title = escapeHtml(path ? PUBLIC_PAGES[path].title : SITE_NAME);
        const description = path ? PUBLIC_PAGES[path].description : PUBLIC_PAGES['/'].description;
        const safeDescription = escapeHtml(description);
        const canonical = path ? escapeHtml(new URL(path, site).href) : undefined;
        const robots = indexable && canonical ? 'max-image-preview:large' : 'noindex';
        const metadata = [
            `<title>${title}</title>`,
            `<meta name="description" content="${safeDescription}" />`,
            `<meta name="robots" content="${robots}" />`,
            ...(canonical ? [
                `<link rel="canonical" href="${canonical}" />`,
                `<meta property="og:url" content="${canonical}" />`
            ] : []),
            '<meta property="og:type" content="website" />',
            '<meta property="og:locale" content="en_US" />',
            `<meta property="og:site_name" content="${SITE_NAME}" />`,
            `<meta property="og:title" content="${title}" />`,
            `<meta property="og:description" content="${safeDescription}" />`,
            `<meta property="og:image" content="${escapeHtml(image)}" />`,
            '<meta property="og:image:type" content="image/png" />',
            `<meta property="og:image:width" content="${SOCIAL_IMAGE_WIDTH}" />`,
            `<meta property="og:image:height" content="${SOCIAL_IMAGE_HEIGHT}" />`,
            `<meta property="og:image:alt" content="${SOCIAL_IMAGE_ALT}" />`,
            '<meta name="twitter:card" content="summary_large_image" />',
            `<meta name="twitter:title" content="${title}" />`,
            `<meta name="twitter:description" content="${safeDescription}" />`,
            `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
            `<meta name="twitter:image:alt" content="${SOCIAL_IMAGE_ALT}" />`
        ];

        if (path === '/') {
            const structuredData = {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: SITE_NAME,
                url: new URL('/', site).href,
                description,
                inLanguage: ['en', 'ar']
            };
            metadata.push(`<script type="application/ld+json">${JSON.stringify(structuredData).replaceAll('<', '\\u003c')}</script>`);
        }

        return metadata.join('\n    ');
    }

    return {
        name: 'future-robins-seo',
        transformIndexHtml(html, { server, path, originalUrl }) {
            if (!server) return html;
            const pathname = (originalUrl ?? path).split('?')[0];
            return html.replace(METADATA, () => renderMetadata(getPublicPath(pathname)));
        },
        configurePreviewServer(server) {
            // Vite's history fallback runs before this middleware and defaults to the homepage.
            return () => server.middlewares.use((req, _res, next) => {
                const path = req.originalUrl?.split('?')[0].replace(/\/+$/, '').toLowerCase();
                if (req.url === '/index.html' && path && path !== '/index.html') {
                    req.url = getPublicPath(path) ? `/pages${path}.html` : '/app.html';
                }
                next();
            });
        },
        generateBundle: {
            order: 'post',
            handler(_options, bundle) {
                const index = bundle['index.html'];
                if (index?.type !== 'asset' || typeof index.source !== 'string' || !index.source.includes(METADATA)) {
                    this.error('Could not find the page metadata marker in the built HTML.');
                }

                const html = index.source;
                index.source = html.replace(METADATA, () => renderMetadata('/'));
                this.emitFile({ type: 'asset', fileName: 'app.html', source: html.replace(METADATA, () => renderMetadata()) });

                const routePages = [
                    ...pages.filter((path) => path !== '/').map((path) => [path, path] as const),
                    ...Object.entries(PUBLIC_ALIASES)
                ];
                for (const [route, canonical] of routePages) {
                    this.emitFile({
                        type: 'asset',
                        fileName: `pages/${route.slice(1)}.html`,
                        source: html.replace(METADATA, () => renderMetadata(canonical))
                    });
                }

                const urls = pages.map((path) => `  <url><loc>${escapeHtml(new URL(path, site).href)}</loc></url>`).join('\n');
                const sitemap = indexable ? `\nSitemap: ${new URL('/sitemap.xml', site).href}\n` : '';
                this.emitFile({
                    type: 'asset',
                    fileName: 'robots.txt',
                    source: `User-agent: *\nAllow: /\n${sitemap}`
                });
                this.emitFile({
                    type: 'asset',
                    fileName: 'sitemap.xml',
                    source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
                });
            }
        }
    };
}
