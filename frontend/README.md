# Facturamas Frontend

Aplicación React de Facturamas para gestionar facturas, presupuestos, clientes, contactos y paneles de resumen.

## Project Structure

```
src/
├── components/          # Reusable React components
│   └── common/         # Common/shared components
├── pages/              # Page components (routes)
├── hooks/              # Custom React hooks
├── services/           # API services and external integrations
├── utils/              # Utility functions and helpers
├── types/              # TypeScript types and interfaces
├── context/            # React Context for state management
├── constants/          # Application constants
├── styles/             # Global and shared styles
├── assets/             # Static assets (images, icons, etc.)
│   ├── images/
│   └── icons/
├── config/             # Application configuration
├── App.tsx             # Root component
├── main.tsx            # Application entry point
└── index.css           # Global styles

public/                 # Static files served directly
tests/                  # Test files
```

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env.local
```

3. Update `.env.local` with your configuration

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Build

Build for production:
```bash
npm run build
```

### Testing

Run tests:
```bash
npm run test
```

Run tests with UI:
```bash
npm run test:ui
```

### Linting

Check code quality:
```bash
npm run lint
```

## Architecture Guidelines

### Components
- **Smart Components**: Container components that handle logic and state (in `pages/`)
- **Presentational Components**: Dumb components that only receive props (in `components/common/`)
- Keep components small and focused
- Use TypeScript for type safety

### Hooks
- Create custom hooks for reusable logic
- Follow the naming convention: `useXxx`
- Place in `src/hooks/`

### Services
- Centralize API calls in services
- Use axios or fetch for HTTP requests
- Keep services focused and single-responsibility

### Types
- Define all TypeScript types and interfaces in `src/types/`
- Use meaningful names and documentation
- Export from barrel files for easy imports

### State Management
- Use React Context for global state
- Consider Redux/Zustand for complex state
- Keep context files in `src/context/`

## Path Aliases

The project is configured with path aliases for cleaner imports:

```typescript
// Instead of:
import Button from '../../../components/common/Button'

// Use:
import Button from '@components/common/Button'
```

Available aliases:
- `@/*` - src root
- `@components/*` - src/components
- `@pages/*` - src/pages
- `@hooks/*` - src/hooks
- `@services/*` - src/services
- `@utils/*` - src/utils
- `@types/*` - src/types
- `@context/*` - src/context
- `@constants/*` - src/constants
- `@styles/*` - src/styles
- `@assets/*` - src/assets
- `@config/*` - src/config

## Best Practices

1. **Components**
   - Keep components small and focused
   - Use functional components with hooks
   - Separate business logic from presentation

2. **State Management**
   - Lift state up when needed
   - Use Context API for cross-cutting concerns
   - Keep component state local when possible

3. **Performance**
   - Use React.memo for preventing unnecessary re-renders
   - Use useCallback for memoized functions
   - Implement code splitting with lazy loading

4. **Testing**
   - Write unit tests for utilities and hooks
   - Write integration tests for components
   - Aim for good coverage but prioritize critical paths

5. **Code Organization**
   - One component per file (unless very small)
   - Use barrel exports (`index.ts`) for cleaner imports
   - Keep related files together

## Technologies

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Vitest** - Testing framework
- **Axios** - HTTP client
- **ESLint** - Code quality

## Environment Variables

See `.env.example` for available configuration options.

## Contributing

1. Create a feature branch
2. Make your changes
3. Ensure tests pass: `npm run test`
4. Ensure code quality: `npm run lint`
5. Submit a pull request

## License

MIT

---

**Happy coding! 🚀**
