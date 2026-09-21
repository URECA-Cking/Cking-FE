import { Link } from 'react-router-dom'
import { ROUTES } from '../routes'

export default function Header() {
  return (
    <header className="site-header">
      <nav>
        <ul>
          {ROUTES.map((route) => (
            <li key={route.path}>
              <Link to={route.path}>{route.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
