import { Link } from 'react-router-dom';
import { Arrow } from '../components/ui.jsx';
import { useContent } from '../content/ContentContext.jsx';

export default function NotFound() {
  const { notFound } = useContent();
  return (
    <main className="notfound">
      <div>
        <p className="display notfound__num">404</p>
        <p>{notFound.text}</p>
        <Link className="btn btn--accent" to="/">
          {notFound.button} <Arrow />
        </Link>
      </div>
    </main>
  );
}
