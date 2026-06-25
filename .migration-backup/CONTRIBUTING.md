# Contributing Guide

Thank you for your interest in contributing to the MikroTik Billing application! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Reporting Issues](#reporting-issues)

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+ (optional, for production features)
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/IKIYY19/Mikrotik-billing.git
cd Mikrotik-billing

# Install dependencies
npm install  # Root installs both client and server

# Or install separately
cd client && npm install
cd ../server && npm install

# Set up environment variables
cp .env.template .env
# Edit .env and set required values (especially JWT_SECRET and ENCRYPTION_KEY)

# Generate secure secrets
openssl rand -hex 64  # For JWT_SECRET
openssl rand -hex 32  # For ENCRYPTION_KEY
```

### Running the App

```bash
# Development mode (runs both client and server)
npm run dev

# Or run separately
cd client && npm run dev    # Frontend: http://localhost:5173
cd ../server && npm run dev # Backend: http://localhost:5000
```

## Development Workflow

### 1. Create a Branch

```bash
# Create a branch for your feature/fix
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

**Branch naming conventions:**
- `feature/add-payments` - New features
- `fix/reseller-creation` - Bug fixes
- `docs/update-readme` - Documentation
- `refactor/auth-logic` - Code refactoring
- `test/add-billing-tests` - Adding tests

### 2. Make Your Changes

- Write clean, readable code
- Follow existing code style
- Add/update tests for your changes
- Update documentation if needed

### 3. Test Your Changes

```bash
# Run backend tests
cd server && npm test

# Run frontend lint
cd client && npm run lint

# Test manually
npm run dev
# Open http://localhost:5173 and test your changes
```

### 4. Commit Your Changes

See [Commit Messages](#commit-messages) for format.

```bash
git add .
git commit -m "feat: add payment validation"
```

### 5. Push and Create PR

```bash
git push origin your-branch-name
# Then create a Pull Request on GitHub
```

## Code Standards

### JavaScript Style

- Use `const` by default, `let` when reassignment needed
- Use descriptive variable names (`customerCount` not `cc`)
- Use async/await instead of callbacks
- Handle all errors properly (try/catch)
- Use the logger instead of console.log

```javascript
// ✅ Good
const { toast } = useToast();

try {
  const result = await api.post('/customers', data);
  if (result.success) {
    toast.success('Customer created');
  } else {
    toast.error(result.error);
  }
} catch (error) {
  logger.error('Failed to create customer', { error: error.message });
  toast.error('Failed to create customer');
}

// ❌ Bad
let res = await axios.post('/customers', data);
console.log(res);
alert('done');
```

### React Best Practices

- Use functional components with hooks
- Keep components small (< 200 lines)
- Use custom hooks for reusable logic
- Add error boundaries around heavy components
- Use the toast system for user feedback

```javascript
// ✅ Good structure
export function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const { toast } = useToast();
  
  useEffect(() => { loadCustomers(); }, []);
  
  return (
    <SectionErrorBoundary sectionName="Customers">
      <CustomersList data={customers} />
    </SectionErrorBoundary>
  );
}
```

### API Calls

Use the `api-helpers.js` instead of raw axios:

```javascript
// ✅ Good
import { customerAPI } from '@/lib/api-helpers';

const result = await customerAPI.create(data);
if (result.success) {
  toast.success('Customer created');
} else {
  toast.error(result.error);
}

// ❌ Bad
const res = await axios.post('/api/customers', data);
```

### Validation

Use validation utilities on both frontend and backend:

```javascript
// Frontend
import { validationSchemas, validateForm } from '@/utils/validation';

const { isValid, errors } = validateForm(formData, validationSchemas.reseller);
if (!isValid) {
  toast.error(Object.values(errors)[0]);
  return;
}

// Backend (in routes)
const { resellerValidation } = require('../middleware/validation');
router.post('/', resellerValidation, async (req, res) => {
  // ...
});
```

## Testing

### Writing Tests

```javascript
describe('Feature Name', () => {
  test('should do something specific', async () => {
    // Arrange
    const input = { name: 'Test' };
    
    // Act
    const result = await createFeature(input);
    
    // Assert
    expect(result.name).toBe('Test');
  });
});
```

### Test Coverage

Aim for 80%+ coverage on critical paths:
- Authentication
- Billing operations
- Customer/Reseller management
- API endpoints

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type: description

optional body for context
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, semicolons, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

**Examples:**

```bash
feat: add reseller commission tracking
fix: prevent duplicate customer creation
docs: update API documentation
refactor: extract auth logic to separate file
test: add billing integration tests
chore: update dependencies
```

## Pull Requests

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Manual testing completed
- [ ] Documentation updated

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Added/updated tests
- [ ] Manual testing completed
- [ ] All tests pass

## Screenshots (if applicable)
Add screenshots of UI changes

## Checklist
- [ ] Code follows project conventions
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

## Reporting Issues

Use [GitHub Issues](https://github.com/IKIYY19/Mikrotik-billing/issues) with appropriate templates:

- **Bug Report**: Use the bug template
- **Feature Request**: Use the feature template
- **Question**: Start title with `[QUESTION]`

### Good Bug Reports Include:

1. Clear description
2. Steps to reproduce
3. Expected vs actual behavior
4. Environment details
5. Console errors/logs
6. Screenshots if applicable

## Code Review Process

All PRs are reviewed before merging:

1. **Automated Checks** - Tests and linting
2. **Code Review** - At least one maintainer reviews
3. **Testing** - Manual testing of changes
4. **Approval** - PR approved before merge

## Need Help?

- Check [TESTING.md](TESTING.md) for testing guide
- Check existing issues for examples
- Ask questions in discussions
- Read the codebase - it's the best documentation!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
