FROM docker.io/library/node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM docker.io/library/nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN chown -R 101:0 /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html \
 && chmod -R g+rwX /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html
USER 101
EXPOSE 8080
