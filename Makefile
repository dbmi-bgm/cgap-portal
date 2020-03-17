clean:  # clear node modules, eggs, npm build stuff 
	rm -rf node_modules eggs
	rm -rf .sass-cache
	rm -f src/encoded/static/css/*.css
	rm -f src/encoded/static/build/*.js
	rm -f src/encoded/static/build/*.html
	rm -rf develop

aws-ip-ranges:
	curl -o aws-ip-ranges.json https://ip-ranges.amazonaws.com/ip-ranges.json

npm-setup:  # runs all front-end setup
	npm install
	npm run build | grep -v "node_modules\|\[built\]"
	npm run build-scss
	curl -o aws-ip-ranges.json https://ip-ranges.amazonaws.com/ip-ranges.json

moto-setup:  # optional moto setup that must be done separately 
	pip install "moto[server]"

macpoetry-install:  # install for OSX Catalina
	bin/macpoetry-install

configure:  # does any pre-requisite installs
	pip install poetry 

macbuild: # builds for Catalina
	make configure
	make macpoetry-install
	make build-after-poetry

build:  # builds 
	make configure
	poetry install 
	make build-after-poetry

build-after-poetry:  # continuation of build after poetry install
	make npm-setup
	python setup_eb.py develop

build-dev:  # same as build but gives moto setup as well
	make build
	make moto-setup
	pip install locust

deploy1:  # starts postgres/ES locally and loads inserts
	dev-servers development.ini --app-name app --clear --init --load

deploy2:  # spins up waittress to serve the application
	pserve development.ini
