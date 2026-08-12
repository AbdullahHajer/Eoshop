import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import ProductArt from './ProductArt';

describe('ProductArt', () => {
  it('renders a remote product image when one is supplied', () => {
    const markup = renderToStaticMarkup(
      <ProductArt
        keyword="perfume"
        primaryColor="#123456"
        imageUrl="https://example.test/product.jpg"
      />,
    );

    expect(markup).toContain('<img');
    expect(markup).toContain('https://example.test/product.jpg');
    expect(markup).toContain('alt="Product Graphic"');
  });

  it('renders deterministic inline artwork when no image is supplied', () => {
    const markup = renderToStaticMarkup(
      <ProductArt keyword="perfume" primaryColor="#123456" />,
    );

    expect(markup).toContain('<svg');
    expect(markup).toContain('stroke="#123456"');
    expect(markup).not.toContain('<img');
  });
});
