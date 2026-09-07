.PHONY: test check typecheck lint pack

test:
	npm test
check:
	npm run check
typecheck:
	npm run typecheck
lint:
	npm run lint
pack:
	npm run pack:check
