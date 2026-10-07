import React, { useMemo } from 'react';

/**
 * Tiny dependency-free math typesetter for the analytical formulas shown in the UI.
 *
 * Supported LaTeX subset:
 *   \frac{a}{b}   \sqrt{a}   \left( ... \right)   x_{sub}   x_y   \text{upright}
 *   \alpha \pi \theta \phi \omega   \cdot \times \approx   \cos \sin \tan   \,  \;
 *   + - = ( ) [ ] / , . digits and single-letter variables (rendered italic)
 *
 * Only inline styles are used so it renders correctly regardless of Tailwind config.
 */

const MATH_FONT =
  '"Cambria Math", "STIX Two Math", "STIX Two Text", "Latin Modern Math", "Times New Roman", Georgia, serif';

const SYMBOLS: Record<string, string> = {
  alpha: 'α',
  theta: 'θ',
  phi: 'φ',
  omega: 'ω',
  pi: 'π',
};
const OPERATORS: Record<string, string> = {
  cdot: '·',
  times: '×',
  approx: '≈',
};
const FUNCTIONS = new Set(['cos', 'sin', 'tan']);

const opStyle: React.CSSProperties = { margin: '0 0.28em' };
const italic: React.CSSProperties = { fontStyle: 'italic' };

class Parser {
  private i = 0;
  private key = 0;
  private fracDepth = 0;
  private fracCount = 0;

  constructor(private readonly s: string) {}

  private k() {
    return this.key++;
  }

  parseAll(): React.ReactNode[] {
    return this.parseSeq(() => false);
  }

  private parseSeq(stop: () => boolean): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    while (this.i < this.s.length && !stop()) {
      const atom = this.parseAtom();
      if (atom !== null) out.push(atom);
    }
    return out;
  }

  private parseGroup(): React.ReactNode[] {
    // Expects "{ ... }"; tolerates a bare single atom.
    if (this.s[this.i] === '{') {
      this.i++;
      const nodes = this.parseSeq(() => this.s[this.i] === '}');
      this.i++; // consume }
      return nodes;
    }
    const a = this.parseAtom();
    return a === null ? [] : [a];
  }

  private readRawGroup(): string {
    if (this.s[this.i] !== '{') return '';
    const end = this.s.indexOf('}', this.i);
    const raw = this.s.slice(this.i + 1, end);
    this.i = end + 1;
    return raw;
  }

  private parseAtom(): React.ReactNode | null {
    let node = this.parseBase();
    // Subscripts: x_{...} or x_y
    while (node !== null && this.s[this.i] === '_') {
      this.i++;
      const sub = this.parseGroup();
      node = (
        <span key={this.k()} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
          {node}
          <span style={{ fontSize: '0.68em', verticalAlign: '-0.28em', marginLeft: '0.06em', lineHeight: 0 }}>
            {sub}
          </span>
        </span>
      );
    }
    return node;
  }

  private parseBase(): React.ReactNode | null {
    const c = this.s[this.i];

    if (c === ' ') {
      this.i++;
      return null;
    }

    if (c === '{') {
      return <React.Fragment key={this.k()}>{this.parseGroup()}</React.Fragment>;
    }

    if (c === '\\') {
      this.i++;
      const m = /^[a-zA-Z]+/.exec(this.s.slice(this.i));
      if (!m) {
        // Escaped punctuation: \, \; \  etc.
        const p = this.s[this.i++];
        const w = p === ',' ? '0.17em' : p === ';' ? '0.28em' : '0.25em';
        return <span key={this.k()} style={{ display: 'inline-block', width: w }} />;
      }
      const name = m[0];
      this.i += name.length;

      if (name === 'frac') return this.frac();
      if (name === 'sqrt') return this.sqrt();
      if (name === 'left') return this.delimited();
      if (name === 'text') {
        return (
          <span key={this.k()} style={{ fontStyle: 'normal' }}>
            {this.readRawGroup()}
          </span>
        );
      }
      if (FUNCTIONS.has(name)) {
        return (
          <span key={this.k()} style={{ fontStyle: 'normal', margin: '0 0.18em 0 0.16em' }}>
            {name}
          </span>
        );
      }
      if (name in OPERATORS) {
        return (
          <span key={this.k()} style={opStyle}>
            {OPERATORS[name]}
          </span>
        );
      }
      if (name in SYMBOLS) {
        return (
          <span key={this.k()} style={name === 'pi' ? { fontStyle: 'normal' } : italic}>
            {SYMBOLS[name]}
          </span>
        );
      }
      return <span key={this.k()}>{name}</span>;
    }

    if (/[0-9.]/.test(c)) {
      const m = /^[0-9.]+/.exec(this.s.slice(this.i))!;
      this.i += m[0].length;
      return <span key={this.k()}>{m[0]}</span>;
    }

    if (/[A-Za-z]/.test(c)) {
      this.i++;
      return (
        <span key={this.k()} style={italic}>
          {c}
        </span>
      );
    }

    if (c === '+' || c === '=' || c === '-') {
      this.i++;
      return (
        <span key={this.k()} style={opStyle}>
          {c === '-' ? '−' : c}
        </span>
      );
    }

    this.i++;
    if (c === '}' || c === '_') return null;
    return <span key={this.k()}>{c}</span>;
  }

  private frac(): React.ReactNode {
    const nested = this.fracDepth > 0;
    this.fracDepth++;
    this.fracCount++;
    const num = this.parseGroup();
    const den = this.parseGroup();
    this.fracDepth--;
    return (
      <span
        key={this.k()}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          verticalAlign: 'middle',
          margin: '0 0.12em',
          fontSize: nested ? '0.86em' : undefined,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 0.3em 0.08em',
            borderBottom: '0.075em solid currentColor',
            lineHeight: 1.25,
          }}
        >
          {num}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.08em 0.3em 0', lineHeight: 1.25 }}>
          {den}
        </span>
      </span>
    );
  }

  private sqrt(): React.ReactNode {
    const content = this.parseGroup();
    return (
      <span key={this.k()} style={{ display: 'inline-flex', alignItems: 'stretch', margin: '0 0.12em 0 0.22em' }}>
        <svg
          viewBox="0 0 12 24"
          preserveAspectRatio="none"
          style={{ width: '0.72em', alignSelf: 'stretch', flexShrink: 0, overflow: 'visible' }}
          aria-hidden="true"
        >
          <path
            d="M0.5 13.5 L2.6 12.2 L5.6 22.5 L11.6 0.6 L12.5 0.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.15"
            strokeLinejoin="miter"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            borderTop: '0.075em solid currentColor',
            padding: '0.14em 0.12em 0.04em 0.1em',
          }}
        >
          {content}
        </span>
      </span>
    );
  }

  private delimited(): React.ReactNode {
    const open = this.s[this.i++];
    const before = this.fracCount;
    const content = this.parseSeq(() => this.s.startsWith('\\right', this.i));
    this.i += '\\right'.length;
    const close = this.s[this.i++];
    const tall = this.fracCount > before;
    const delim = (ch: string) => (
      <span
        style={{
          display: 'inline-block',
          alignSelf: 'center',
          transform: tall ? 'scale(1.1, 2.1)' : undefined,
          fontWeight: 300,
          margin: tall ? '0 0.18em' : undefined,
        }}
      >
        {ch}
      </span>
    );
    return (
      <span key={this.k()} style={{ display: 'inline-flex', alignItems: 'center' }}>
        {delim(open)}
        {content}
        {delim(close)}
      </span>
    );
  }
}

interface MathFormulaProps {
  /** Formula in the LaTeX subset documented at the top of this file. */
  tex: string;
  className?: string;
  style?: React.CSSProperties;
}

export const MathFormula: React.FC<MathFormulaProps> = ({ tex, className, style }) => {
  const nodes = useMemo(() => new Parser(tex).parseAll(), [tex]);
  return (
    <span
      role="math"
      aria-label={tex.replace(/\\[a-zA-Z]+|[{}\\]/g, ' ')}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        fontFamily: MATH_FONT,
        fontSize: '1.2em',
        lineHeight: 1.3,
        ...style,
      }}
    >
      {nodes}
    </span>
  );
};

export default MathFormula;
