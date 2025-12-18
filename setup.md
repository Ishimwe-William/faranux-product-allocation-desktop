## Generate New Release

```bash

# 1. Check what files are uncommitted
git status
```

```bash
# 2. Add all changes
git add .
```

```bash
# 3. Commit the changes
git commit -m "Setup automated releases and update configuration"
```    

```bash
# 4. Now run the release
npm run release
```

### What This Will Do:

    ✅ Commit your current changes
    ✅ Bump version from 1.0.4 to 1.0.5
    ✅ Create a commit with the version bump
    ✅ Create a git tag v1.0.5
    ✅ Push both commits and tags to GitHub
    ✅ Trigger GitHub Actions to build and publish