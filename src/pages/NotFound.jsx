import { Link } from 'react-router-dom';
import { Arrow } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <main className="notfound">
      <div>
        <p className="display notfound__num">404</p>
        <p>This table is empty. The page you are looking for has moved or never existed.</p>
        <Link className="btn btn--accent" to="/">
          Back to the lounge <Arrow />
        </Link>
      </div>
    </main>
  );
}
