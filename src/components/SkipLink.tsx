import { skipLink } from '../content/site';

/** First focusable element on every page (§8.1). Targets <main id="main" tabIndex={-1}>. */
export default function SkipLink() {
  return (
    <a href="#main" className="skip-link btn btn-ember">
      {skipLink}
    </a>
  );
}
