import { Route, Routes } from 'react-router';
import { AppLayout } from './layout/AppLayout.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { EventTypeCatalogPage } from './pages/EventTypeCatalogPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { paths } from './paths.ts';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path={paths.catalog} element={<EventTypeCatalogPage />} />
        <Route path={paths.admin} element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
