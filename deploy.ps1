$remoteCommand = "cd /opt/pancho-os; git pull > build.log 2>&1; npm run build >> build.log 2>&1; pm2 restart pancho-os >> build.log 2>&1"
ssh root@178.105.163.120 $remoteCommand
