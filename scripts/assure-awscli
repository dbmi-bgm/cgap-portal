awscli_version=`pip freeze 2>&1 | grep awscli== | cut -d '=' -f 3`

if [ -z "${awscli_version}" ]; then
  # e.g., awscli==1.20.17

  echo "awscli is not installed. Using pip to install it now..."

  pip install awscli 2> /dev/null

else

  echo "awscli ${awscli_version} is installed."

fi
