import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import NotFound from './pages/NotFound'
import { ROUTES } from './routes'

function App() {
  return (
    <Layout>
      <Routes>
        {ROUTES.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}

export default App
